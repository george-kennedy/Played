/**
 * Builds data/facilities.json from public provincial member lists.
 * Names and list places come from those pages. Hole count, access,
 * coordinates, course ids, and rating/slope come from the public
 * Golf Canada facility record the association finders use.
 *
 * Run: node scripts/build-seed.mjs
 */
import { writeFileSync } from "node:fs";

const SOURCES = {
  NS: "https://nsga.ns.ca/member-clubs/",
  PEI: "https://golfpei.ca/course_directory_list/",
  NB: "https://www.golfnb.ca/member-facilities/",
  NL: "https://www.golfnl.ca/member-courses/",
};

/** Published name, optional place from the same list, optional search hint. */
const LISTS = {
  NS: [
    "Baddeck Forks Golf Club",
    "Bell Bay Golf Club",
    ["Cabot Cliffs", "Cabot Cliffs"],
    ["Cabot Links", "Cabot Links"],
    "Cabot The Nest",
    "Dundee Resort & Golf Club",
    "Highland Links Golf Club",
    "The Lakes Golf Club",
    "LePortage Golf Club",
    "Lingan Golf Club",
    "Passchendaele Golf Course",
    "Seaview Golf Club",
    "Abercrombie Country Club",
    "Antigonish Golf Club",
    "Glen Lovat Golf Club",
    "Amherst Golf Club",
    "Brookfield Golf Club",
    "Brule Point Golf Club",
    "Fox Harbr’ Golf Resort",
    "Fox Hollow Golf Club",
    "Mountain Golf & Country Club",
    "Northumberland Links Golf Course",
    "Oakfield Golf & Country Club",
    "Parrsboro Golf Club",
    "River Oaks Golf Club",
    "Truro Golf Club",
    "The Links at Penn Hills",
    "Spring Hill Centennial Golf Club",
    ["Ashburn Golf Club (Old Course)", "Ashburn", "old"],
    ["Ashburn Golf Club (New Course)", "Ashburn", "new"],
    "Brightwood Golf Club",
    "Glen Arbour Golf Club",
    "Grandview Golf & Country Club",
    "Granite Springs Golf Club",
    "Hartlen Point Golf Club",
    "The Links at Brunello",
    "Lost Creek Golf Club",
    "Avon Valley Golf Club",
    "Berwick Heights Golf Club",
    "Clare Golf & Country Club",
    "Coyote Hills Golf Course",
    "Digby Pines Golf Resort & Spa",
    "Eagle Crest Golf Club",
    "Eden Golf Club",
    "Fort View Golf Course",
    "Greenwood Golf Club",
    "KenWo Golf Club",
    "Paragon Golf & Country Club",
    "Aspotogan Ridge Golf Club",
    "Bluenose Golf Club",
    "Chester Golf Club",
    "Osprey Ridge Golf Club",
    "River Hills Golf Club",
    "Sherwood Golf Club",
    "West Pubnico Golf Club",
    "White Point Golf Club",
    "Yarmouth Links Golf Club",
  ],
  PEI: [
    "Andersons Creek GC",
    "Avondale Golf Course",
    "Belfast Highland Greens",
    "Belvedere Golf Club",
    "Brudenell River GC",
    "Clyde River Golf & CC",
    "Countryview Golf Club",
    "The Links at Crowbush Cove",
    "Dundarave Golf Course",
    "Eagles Glenn",
    "Forest Hills",
    "Fox Meadow Golf Course",
    "Glasgow Hills Resort & GC",
    "Green Gables Golf Course",
    "Mill River",
    "Red Sands GC",
    "Rustico Resort Golf Club",
    "Stanhope Golf & CC",
  ],
  NB: [
    ["Algonquin Golf Course", null, null, "St. Andrews"],
    ["Aroostook Valley Country Club", null, null, "Four Falls"],
    ["Golf Bouctouche", null, null, "Bouctouche"],
    ["Country Meadows Golf Club", null, null, "Indian Mountain"],
    ["Covered Bridge Golf & Country Club", null, null, "Hartland"],
    ["Fox Creek Golf Club", null, null, "Dieppe"],
    ["Fraser Edmundston Golf Club", null, null, "Edmundston"],
    ["Fredericton Golf Club", null, null, "Fredericton"],
    ["Fundy National Park Golf Club", null, null, "Alma"],
    ["Gage Golf & Curling Club", null, null, "Oromocto"],
    ["Gowan Brae Golf & Country Club", null, null, "Bathurst"],
    ["Grand Falls Golf Club Inc.", null, null, "Grand Falls"],
    ["GreyRock Golf", null, null, "Edmundston"],
    ["Hampton Golf Club", null, null, "Hampton"],
    ["Herring Cove Provincial Park Golf Club", null, null, "Welshpool"],
    ["Hillsborough Golf Club", null, null, "Hillsborough"],
    ["JH Sports", null, null, "Fredericton"],
    ["Kingswood Golf", null, null, "Fredericton"],
    ["Lakeside Golf & Country Club", null, null, "Lakeville"],
    ["Mactaquac Provincial Park Golf Club", null, null, "Mactaquac"],
    ["Maplewood Golf & Country Club", null, null, "Irishtown"],
    ["Memramcook Valley Golf Club", null, null, "Memramcook"],
    ["Midland Meadows Golf Club", null, null, "Norton"],
    ["Miramichi Golf & Country Club", null, null, "Miramichi"],
    ["Moncton Golf Club", null, null, "Riverview"],
    ["Mountain Woods Golf Club", null, null, "Moncton"],
    ["Nackawic Golf & Country Club", null, null, "Nackawic"],
    ["Old Mill Pond Golf & Country Club", null, null, "Doaktown"],
    ["Par94 Bar & Lounge", null, null, "Fredericton"],
    ["Petitcodiac Valley Golf & Country Club", null, null, "Petitcodiac"],
    ["Pine Needles Golf & Country Club", null, null, "Haute-Aboujagane"],
    ["Plaster Rock Golf Club", null, null, "Plaster Rock"],
    ["Golf Pokemouche", null, null, "Pokemouche"],
    ["Restigouche Golf Club", null, null, "Campbellton"],
    ["Riverbend Golf & Fishing Club", null, null, "Durham Bridge"],
    ["The Riverside Country Club", null, null, "Rothesay"],
    ["Rockwood Park Golf Club", null, null, "Saint John"],
    ["Royal Oaks Golf Club", null, null, "Moncton"],
    ["Sackville Golf & Country Club", null, null, "Sackville"],
    ["Saint-Quentin Golf Club", null, null, "Saint-Quentin"],
    ["Squire Green Golf Club", null, null, "Bathurst"],
    ["St. Margaret’s Golf Club", null, null, "Saint Margarets"],
    ["St. Stephen Golf Club", null, null, "Oak Bay"],
    ["St-Ignace Ltee Club de Golf", null, null, "Saint-Ignace"],
    ["Sussex Golf & Curling Club", null, null, "Sussex"],
    ["The Hollows Golf Club", null, null, "Utopia"],
    ["Top Shots Golf", null, null, "Saint John"],
    ["Under Par Golf & Academy", null, null, "Saint John"],
    ["Welsford Golf Course", null, null, "Welsford"],
    ["Westfield Golf and Country Club", null, null, "Grand Bay-Westfield"],
    ["West Hills Golf Course", null, null, "Fredericton"],
    ["Woodstock Golf & Curling Club", null, null, "Woodstock"],
  ],
  NL: [
    ["Amaruk Golf & Sports Club", null, null, null, "https://www.golfnl.ca/location/amaruk-golf-sports-club/"],
    ["Bally Hally Country Club", null, null, null, "https://www.golfnl.ca/location/bally-hally-country-club/"],
    ["Blomidon Golf Club", null, null, null, "https://www.golfnl.ca/location/blomidon-golf-club/"],
    ["Gander Golf Club", null, null, null, "https://www.golfnl.ca/location/gander-golf-club/"],
    ["Glendenning Golf", null, null, null, "https://www.golfnl.ca/location/glendenning-golf/"],
    ["Grand Falls Golf Club", null, null, null, "https://www.golfnl.ca/location/grand-falls-golf-club/"],
    ["Grande Meadows Golf Club", null, null, null, "https://www.golfnl.ca/location/grande-meadows-golf-club/"],
    ["Gros Morne Golf Course", null, null, null, "https://www.golfnl.ca/location/gros-morne-golf-course/"],
    ["Harmon Seaside Links", null, null, null, "https://www.golfnl.ca/location/harmon-seaside-links/"],
    ["Humber River Golf Club", null, null, null, "https://www.golfnl.ca/location/humber-river-golf-club/"],
    ["Humber Valley Resort", null, null, null, "https://www.golfnl.ca/location/humber-valley-golf-course/"],
    ["Pippy Park Golf Course", null, null, null, "https://www.golfnl.ca/location/pippy-park-golf-course/"],
    ["Pitcher’s Pond Golf Club", null, null, null, "https://www.golfnl.ca/location/pitchers-pond-golf-club/"],
    ["Tamarack Golf Club", null, null, null, "https://www.golfnl.ca/location/tamarack-golf-club/"],
    ["Terra Nova Golf Resort", null, null, null, "https://www.golfnl.ca/location/terra-nova-golf-resort/"],
    ["The Wilds Golf Resort", null, null, null, "https://www.golfnl.ca/location/the-wilds-golf-resort/"],
    ["The Willows at Holyrood", null, null, null, "https://www.golfnl.ca/location/the-willows-at-holyrood/"],
  ],
};

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
  const base = norm(value).replace(/ /g, "-").replace(/-+/g, "-");
  return base || "facility";
}

function holeCountFromCourse(course) {
  const type = course.type || "";
  const known = {
    SixHole: 6,
    SevenHole: 7,
    EightHole: 8,
    NineHole: 9,
    TenHole: 10,
    TwelveHole: 12,
    EighteenHole: 18,
    TwentySevenHole: 27,
    ThirtySixHole: 36,
    Executive: 9,
    Par3: 9,
  };
  if (known[type]) return known[type];
  const fromTee = course.tees?.find((tee) => Array.isArray(tee.holes) && tee.holes.length > 0);
  if (fromTee) return fromTee.holes.length;
  return null;
}

function accessFromType(type) {
  const key = String(type ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (key === "private") return "private";
  if (["public", "semiprivate", "semipublic", "resort", "dailyfee", "municipal"].includes(key)) {
    return "public";
  }
  return null;
}

function pickRating(course) {
  const tees = (course.tees ?? []).filter(
    (tee) => typeof tee.rating === "number" && typeof tee.slope === "number" && tee.rating > 0 && tee.slope > 0,
  );
  if (tees.length === 0) return {};
  const mens = tees.filter((tee) => String(tee.type).toLowerCase() === "mens");
  const pool = mens.length > 0 ? mens : tees;
  const active = pool.filter((tee) => tee.isActive);
  const ranked = (active.length > 0 ? active : pool).slice().sort((a, b) => (b.yardage ?? 0) - (a.yardage ?? 0));
  return { rating: ranked[0].rating, slope: ranked[0].slope };
}

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

const PROVINCE_FROM_API = { NS: "NS", NB: "NB", NL: "NL", PE: "PEI", PEI: "PEI" };
const STOP = new Set(["golf", "club", "course", "and", "the", "at", "cc", "gc", "resort", "country", "links", "inc", "ltee", "of", "a"]);

function tokens(value) {
  return norm(value)
    .split(" ")
    .filter((part) => part && !STOP.has(part))
    .map((part) => (part.endsWith("s") && part.length > 4 ? part.slice(0, -1) : part));
}

function dice(left, right) {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  let overlap = 0;
  for (const token of left) if (rightSet.has(token)) overlap += 1;
  return (2 * overlap) / (left.length + right.length);
}

async function loadCatalog() {
  const centers = [
    [46.4, -63.2, 4],
    [46.2, -60.5, 2],
    [49.2, -55.5, 2],
    [47.6, -67.8, 2],
    [43.8, -66.1, 2],
  ];
  const byId = new Map();
  for (const [latitude, longitude, pages] of centers) {
    for (let page = 1; page <= pages; page += 1) {
      const body = await getJson(
        `https://api.golfcanada.ca/api/v1/facilities/search?latitude=${latitude}&longitude=${longitude}&sort_by=distance&per_page=100&page=${page}&facilitySearchType=All`,
      );
      for (const facility of body.data ?? []) {
        const outdoor = facility.outdoor_details;
        if (!outdoor?.id) continue;
        const province = PROVINCE_FROM_API[facility.province] ?? null;
        if (!province && facility.province !== "ME") continue;
        byId.set(outdoor.id, {
          id: outdoor.id,
          name: outdoor.name || facility.name,
          province: province ?? "ME",
          apiProvince: facility.province,
          city: facility.city,
        });
      }
    }
  }
  return [...byId.values()];
}

async function facilityDetail(id) {
  const body = await getJson(`https://api.golfcanada.ca/api/v1/facilities/${id}`);
  return body.data;
}

function parseEntry(entry) {
  if (typeof entry === "string") {
    return { official_name: entry, keywords: entry, courseHint: null, place: null, source_url: null };
  }
  return {
    official_name: entry[0],
    keywords: entry[1] || entry[0],
    courseHint: entry[2] || null,
    place: entry[3] || null,
    source_url: entry[4] || null,
  };
}

const detailCache = new Map();

async function loadDetail(id) {
  if (!detailCache.has(id)) detailCache.set(id, facilityDetail(id));
  return detailCache.get(id);
}

const SEARCH_ALIASES = {
  "Highland Links Golf Club": "Cape Breton Highlands Links",
  "LePortage Golf Club": "Le Portage Golf Club",
  "Bally Hally Country Club": "Bally Haly Country Club",
  "Spring Hill Centennial Golf Club": "Springhill Centennial Golf Club",
  "Par94 Bar & Lounge": "Par 94 Bar and Golf Lounge",
  "Passchendaele Golf Course": "Passchendaele Golf",
  "Grandview Golf & Country Club": "Eaglequest Grandview",
  "Brookfield Golf Club": "Brookfield Golf",
  "Brudenell River GC": "Brudenell Golf Course",
  "Baddeck Forks Golf Club": "Baddeck Forks",
  "Under Par Golf & Academy": "Under Par Golf",
};

/** Indoor simulator listings on a provincial page. They are not outdoor facilities. */
const OMIT_SIMULATORS = new Set(["GreyRock Golf", "JH Sports", "Top Shots Golf"]);

const MANUAL = [
  {
    facility_id: "pei-rustico-resort-golf-club",
    official_name: "Rustico Resort Golf Club",
    province: "PEI",
    place: "Rustico",
    hole_count: 18,
    access: "public",
    source_url: "https://golfpei.ca/course/rusticoresort/",
    merged_routings: false,
    published_list: SOURCES.PEI,
    note: "Golf PEI course page: “18 holes of ocean view golf” and a tee-time booking link. Not in the Golf Canada facility search used for the rest of the seed.",
  },
  {
    facility_id: "ns-cabot-the-nest",
    official_name: "Cabot The Nest",
    province: "NS",
    place: "Inverness",
    hole_count: 11,
    access: "public",
    source_url: "https://cabot.com/capebreton/",
    merged_routings: false,
    published_list: SOURCES.NS,
    note: "Named on the Golf Nova Scotia member list. Cabot’s public page describes The Nest as an 11-hole par-3 course a non-member can book. No Golf Canada facility id was found.",
  },
];

function compact(value) {
  return norm(value).replace(/ /g, "");
}

function matchScore(left, right) {
  const score = dice(tokens(left), tokens(right));
  const a = compact(left);
  const b = compact(right);
  if (a.length > 5 && b.length > 5 && (a.includes(b) || b.includes(a))) return Math.max(score, 0.9);
  return score;
}

function bestCatalogMatch(catalog, province, names) {
  let best = null;
  for (const name of names) {
    for (const facility of catalog) {
      const allowed = facility.province === province || (province === "NB" && facility.province === "ME" && norm(name).includes("aroostook"));
      if (!allowed) continue;
      const score = matchScore(name, facility.name);
      if (!best || score > best.score) best = { facility, score, query: name };
    }
  }
  if (!best || best.score < 0.66) return { best };
  return { match: best.facility, score: best.score };
}

async function keywordMatch(province, names) {
  let best = null;
  for (const name of names) {
    const body = await getJson(
      `https://api.golfcanada.ca/api/v1/facilities/search?keywords=${encodeURIComponent(name)}&per_page=8`,
    );
    for (const facility of body.data ?? []) {
      const outdoor = facility.outdoor_details;
      if (!outdoor?.id) continue;
      const apiProvince = PROVINCE_FROM_API[facility.province] ?? (facility.province === "ME" ? "ME" : null);
      const allowed = apiProvince === province || (province === "NB" && apiProvince === "ME" && norm(name).includes("aroostook"));
      if (!allowed) continue;
      const score = matchScore(name, outdoor.name || facility.name);
      if (!best || score > best.score) {
        best = { facility: { id: outdoor.id, name: outdoor.name || facility.name, province: apiProvince, city: facility.city }, score };
      }
    }
  }
  if (!best || best.score < 0.66) return { best };
  return { match: best.facility, score: best.score };
}

async function resolveEntry(catalog, province, entry) {
  const parsed = parseEntry(entry);
  if (OMIT_SIMULATORS.has(parsed.official_name)) {
    return {
      gap: `${province}: “${parsed.official_name}” is an indoor simulator on the provincial list, so it is not in the outdoor seed`,
      parsed,
    };
  }
  if (MANUAL.some((row) => row.province === province && row.official_name === parsed.official_name)) {
    return { skip: true, parsed };
  }
  const names = [SEARCH_ALIASES[parsed.official_name], parsed.keywords, parsed.official_name].filter(Boolean);
  let found = bestCatalogMatch(catalog, province, names);
  if (!found.match) found = await keywordMatch(province, names);
  const { match, best } = found;
  if (!match) {
    const hint = best ? ` (closest: ${best.facility.name} ${best.score.toFixed(2)})` : "";
    return { gap: `${province}: no Golf Canada outdoor record for “${parsed.official_name}”${hint}`, parsed };
  }
  const facilityId = match.id;
  const detail = await loadDetail(facilityId);
  const courses = (detail.courses ?? []).filter((course) => course.status !== "Inactive");
  const usable = courses.length > 0 ? courses : detail.courses ?? [];
  if (usable.length === 0 || !detail.holes) {
    return { gap: `${province}: “${parsed.official_name}” has no outdoor routing in the Golf Canada record`, parsed };
  }
  let chosen = usable;
  if (parsed.courseHint) {
    const hint = parsed.courseHint.toLowerCase();
    const matched = usable.filter((course) => norm(course.name).includes(hint) || norm(course.shortName).includes(hint));
    if (matched.length === 0) {
      return { gap: `${province}: “${parsed.official_name}” — no routing matching “${parsed.courseHint}” on ${detail.facilityName}`, parsed };
    }
    chosen = matched;
  }
  const holeCounts = chosen.map(holeCountFromCourse).filter((count) => Number.isFinite(count));
  if (holeCounts.length === 0) {
    return { gap: `${province}: “${parsed.official_name}” — hole count not published on the Golf Canada record`, parsed };
  }
  const access = accessFromType(detail.type) || accessFromType(chosen[0].class);
  if (!access) {
    return { gap: `${province}: “${parsed.official_name}” — access “${detail.type}” is not public or private`, parsed };
  }
  const longest = chosen
    .map((course) => ({ course, holes: holeCountFromCourse(course) ?? 0 }))
    .sort((a, b) => b.holes - a.holes)[0].course;
  const rating = pickRating(longest);
  const latitude = Number(detail.latitude);
  const longitude = Number(detail.longitude);
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);
  const ids = [...new Set(chosen.map((course) => String(course.id)))];
  return {
    row: {
      facility_id: `${province.toLowerCase()}-${slugify(parsed.official_name)}`,
      official_name: parsed.official_name,
      province,
      place: parsed.official_name === "Brudenell River GC" ? "Georgetown Royalty" : detail.city || parsed.place || null,
      ...(hasCoords ? { latitude, longitude } : {}),
      hole_count: Math.max(...holeCounts),
      access,
      association_course_id: String(longest.id),
      association_course_ids: ids,
      ...(rating.rating != null ? { rating: rating.rating, slope: rating.slope } : {}),
      source_url: parsed.source_url || SOURCES[province],
      merged_routings: chosen.length > 1,
      record_name: detail.facilityName,
      published_list: SOURCES[province],
    },
  };
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

const catalog = await loadCatalog();
console.log("catalog", catalog.length, "by province", catalog.reduce((map, row) => {
  map[row.province] = (map[row.province] ?? 0) + 1;
  return map;
}, {}));

const jobs = [];
for (const province of ["NS", "PEI", "NB", "NL"]) {
  for (const entry of LISTS[province]) jobs.push({ province, entry });
}

const resolved = await mapPool(jobs, 6, async (job) => {
  try {
    return await resolveEntry(catalog, job.province, job.entry);
  } catch (error) {
    const parsed = parseEntry(job.entry);
    return { gap: `${job.province}: “${parsed.official_name}” failed (${error.message})`, parsed };
  }
});

const rows = [];
const gaps = [];
const seenIds = new Set();
for (const manual of MANUAL) {
  rows.push(manual);
  seenIds.add(manual.facility_id);
}
for (const item of resolved) {
  if (item.skip) continue;
  if (item.gap) {
    gaps.push(item.gap);
    continue;
  }
  if (seenIds.has(item.row.facility_id)) {
    gaps.push(`Duplicate facility_id ${item.row.facility_id} for ${item.row.official_name}`);
    continue;
  }
  seenIds.add(item.row.facility_id);
  rows.push(item.row);
}

rows.sort((a, b) => a.province.localeCompare(b.province) || a.official_name.localeCompare(b.official_name));

const counts = rows.reduce((map, row) => {
  map[row.province] = (map[row.province] ?? 0) + 1;
  return map;
}, {});
const merged = rows.filter((row) => row.merged_routings).map((row) => `${row.province} ${row.official_name} (${row.association_course_ids.join(", ")})`);

const payload = {
  generated_on: "2026-10-06",
  notes:
    "Names are the provincial list names. Cabot Cliffs and Cabot Links, and Ashburn Old and New, are separate facilities because the Golf Nova Scotia list names them separately. A facility with more than one routing of the same published name is one row; hole_count is the longest routing. Indoor-only listings with no outdoor routing are omitted.",
  counts,
  facilities: rows,
};

writeFileSync(new URL("../data/facilities.json", import.meta.url), `${JSON.stringify(payload, null, 2)}\n`);
console.log("counts", counts, "total", rows.length);
console.log("merged", merged.join("\n") || "(none)");
console.log("gaps", gaps.length);
for (const gap of gaps) console.log(" -", gap);
