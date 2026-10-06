/**
 * Adds Golf Canada outdoor facilities outside Atlantic Canada
 * to data/facilities.json. The Atlantic rows already in the file stay.
 *
 * Run: node scripts/build-national.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const EXISTING = new URL("../data/facilities.json", import.meta.url);
const current = JSON.parse(readFileSync(EXISTING, "utf8"));

const PROVINCE = {
  BC: "BC",
  AB: "AB",
  SK: "SK",
  MB: "MB",
  ON: "ON",
  QC: "QC",
  NB: "NB",
  NS: "NS",
  PE: "PEI",
  PEI: "PEI",
  NL: "NL",
  YT: "YT",
  NT: "NT",
  NU: "NU",
  "British Columbia": "BC",
  Alberta: "AB",
  Saskatchewan: "SK",
  Manitoba: "MB",
  Ontario: "ON",
  Quebec: "QC",
  Québec: "QC",
  "New Brunswick": "NB",
  "Nova Scotia": "NS",
  "Prince Edward Island": "PEI",
  "Newfoundland and Labrador": "NL",
  Yukon: "YT",
  "Northwest Territories": "NT",
  Nunavut: "NU",
};

const KEEP = new Set(["NS", "PEI", "NB", "NL"]);

const CENTERS = [
  [49.28, -123.12],
  [48.43, -123.37],
  [49.89, -119.5],
  [53.92, -122.75],
  [54.52, -128.6],
  [51.05, -114.07],
  [53.55, -113.49],
  [56.73, -111.38],
  [50.45, -104.62],
  [52.13, -106.67],
  [49.9, -97.14],
  [53.83, -101.2],
  [48.38, -89.25],
  [46.49, -81.01],
  [42.98, -81.25],
  [43.65, -79.38],
  [45.42, -75.7],
  [44.23, -76.5],
  [46.49, -84.35],
  [45.5, -73.57],
  [46.81, -71.21],
  [48.42, -71.07],
  [48.1, -77.78],
  [60.72, -135.05],
  [62.45, -114.37],
  [63.75, -68.52],
];

function norm(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value) {
  return norm(value).replace(/ /g, "-").replace(/-+/g, "-") || "facility";
}

function accessFromType(type) {
  const key = String(type ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (key === "private") return "private";
  if (["public", "semiprivate", "semipublic", "resort", "dailyfee", "municipal"].includes(key)) return "public";
  return "public";
}

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

const found = new Map();
for (const [latitude, longitude] of CENTERS) {
  for (let page = 1; page <= 8; page += 1) {
    const body = await getJson(
      `https://api.golfcanada.ca/api/v1/facilities/search?latitude=${latitude}&longitude=${longitude}&sort_by=distance&per_page=100&page=${page}&facilitySearchType=All`,
    );
    const rows = body.data ?? [];
    if (rows.length === 0) break;
    let beyond = 0;
    for (const facility of rows) {
      if (typeof facility.distance_km === "number" && facility.distance_km > 280) {
        beyond += 1;
        continue;
      }
      const outdoor = facility.outdoor_details;
      if (!outdoor?.id) continue;
      const province = PROVINCE[facility.province];
      if (!province || KEEP.has(province)) continue;
      const holes = Number(outdoor.holes);
      if (!Number.isFinite(holes) || holes < 9) continue;
      const lat = Number(facility.latitude);
      const lng = Number(facility.longitude);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
      found.set(outdoor.id, {
        id: outdoor.id,
        name: outdoor.name || facility.name,
        province,
        place: facility.city || null,
        holes,
        access: accessFromType(outdoor.facility_type),
        latitude: hasCoords ? lat : null,
        longitude: hasCoords ? lng : null,
      });
    }
    if (beyond === rows.length) break;
  }
  console.log("center", latitude, longitude, "kept", found.size);
}

const seenIds = new Set(current.facilities.map((row) => row.facility_id));
const added = [];
for (const facility of found.values()) {
  let facilityId = `${facility.province.toLowerCase()}-${slugify(facility.name)}`;
  if (seenIds.has(facilityId)) facilityId = `${facilityId}-${facility.id}`;
  seenIds.add(facilityId);
  added.push({
    facility_id: facilityId,
    official_name: facility.name,
    province: facility.province,
    place: facility.place,
    ...(facility.latitude != null ? { latitude: facility.latitude, longitude: facility.longitude } : {}),
    hole_count: facility.holes,
    access: facility.access,
    association_course_id: String(facility.id),
    association_course_ids: [String(facility.id)],
    source_url: "https://www.golfcanada.ca/",
    merged_routings: false,
    record_name: facility.name,
    published_list: "https://api.golfcanada.ca/api/v1/facilities/search",
  });
}

const facilities = [...current.facilities, ...added].sort(
  (a, b) => a.province.localeCompare(b.province) || a.official_name.localeCompare(b.official_name),
);
const counts = facilities.reduce((map, row) => {
  map[row.province] = (map[row.province] ?? 0) + 1;
  return map;
}, {});

writeFileSync(
  EXISTING,
  `${JSON.stringify(
    {
      ...current,
      generated_on: "2026-10-06",
      notes: `${current.notes} Facilities outside Atlantic Canada come from the public Golf Canada facility search. One outdoor facility is one course. Indoor-only listings are omitted.`,
      counts,
      facilities,
    },
    null,
    2,
  )}\n`,
);
console.log("added", added.length, "total", facilities.length, counts);
