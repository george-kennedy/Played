/**
 * Finds a booking link or a phone number for each public course.
 * Golf Canada is only used to locate the club website. The page itself is fetched once.
 * Reruns skip a course that already has both, or that already failed for a reason other than a dead site.
 *
 *   node scripts/scan-reach.mjs
 *   node scripts/scan-reach.mjs --limit 20
 */
import fs from "node:fs";
import path from "node:path";
import { golfContact, outdoorIdFromSearch, parseClubPage, reachForAccess } from "./reach-parse.mjs";

const ROOT = process.cwd();
const REACH_PATH = path.join(ROOT, "data", "reach.json");
const TROUBLE_PATH = path.join(ROOT, "data", "reach-trouble.json");
const LIMIT = Number(process.argv.find((arg) => arg.startsWith("--limit"))?.split("=")[1] ?? process.argv[process.argv.indexOf("--limit") + 1] ?? 0);
const RETRY = process.argv.includes("--retry");
const CONCURRENCY = 6;
const BODY_CAP = 400_000;

const facilities = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "facilities.json"), "utf8")).facilities;
const reach = new Map(readCourses(REACH_PATH).map((row) => [row.facilityId, row]));
const trouble = new Map(readCourses(TROUBLE_PATH).map((row) => [row.facilityId, row]));

function readCourses(file) {
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(parsed.courses) ? parsed.courses : [];
}

function writeFiles() {
  const reachCourses = [...reach.values()].sort((a, b) => a.facilityId.localeCompare(b.facilityId));
  const troubleCourses = [...trouble.values()].sort((a, b) => a.facilityId.localeCompare(b.facilityId));
  fs.writeFileSync(REACH_PATH, `${JSON.stringify({ courses: reachCourses }, null, 2)}\n`);
  fs.writeFileSync(TROUBLE_PATH, `${JSON.stringify({ courses: troubleCourses }, null, 2)}\n`);
}

async function getJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { accept: "application/json", "user-agent": "Played/1.0 (course directory)" },
  });
  if (!response.ok) return null;
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: { accept: "text/html", "user-agent": "Played/1.0 (course directory)" },
  });
  if (!response.ok) throw new Error(String(response.status));
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let size = 0;
  while (size < BODY_CAP) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    chunks.push(value);
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

async function resolveGolf(facility) {
  const associationId = facility.association_course_id ? String(facility.association_course_id) : "";
  if (associationId) {
    const detail = await getJson(`https://api.golfcanada.ca/api/v1/facilities/${encodeURIComponent(associationId)}`);
    const contact = golfContact(detail, facility.official_name);
    if (contact) return contact;
  }
  if (facility.latitude == null || facility.longitude == null) return null;
  const search = await getJson(
    `https://api.golfcanada.ca/api/v1/facilities/search?latitude=${facility.latitude}&longitude=${facility.longitude}&sort_by=distance&per_page=8&page=1&facilitySearchType=All`,
  );
  const outdoorId = outdoorIdFromSearch(search, facility.official_name);
  if (!outdoorId || outdoorId === associationId) return null;
  const detail = await getJson(`https://api.golfcanada.ca/api/v1/facilities/${encodeURIComponent(outdoorId)}`);
  return golfContact(detail, facility.official_name);
}

async function readSite(websiteUrl, bookingUrl, phone) {
  let booking = bookingUrl;
  let number = phone;
  let failed = false;
  try {
    const html = await fetchText(websiteUrl);
    const page = parseClubPage(html, websiteUrl);
    booking = booking ?? page.bookingUrl;
    number = number ?? page.phone;
    if (page.followUrl && !(booking && number)) {
      const extra = parseClubPage(await fetchText(page.followUrl), page.followUrl);
      booking = booking ?? extra.bookingUrl;
      number = number ?? extra.phone;
    }
  } catch {
    failed = true;
  }
  return { bookingUrl: booking, phone: number, failed };
}

function shouldSkip(facility) {
  const saved = reach.get(facility.facility_id);
  if (saved?.bookingUrl && saved?.phone) return true;
  const problem = trouble.get(facility.facility_id);
  if (!RETRY && (problem?.reason === "no-website" || problem?.reason === "no-phone-or-booking")) return true;
  if (RETRY && problem?.reason === "no-website") return true;
  return false;
}

async function scanOne(facility) {
  if (facility.access === "private" || shouldSkip(facility)) return;
  await new Promise((resolve) => setTimeout(resolve, 40));
  let bookingUrl = null;
  let phone = null;
  let websiteUrl = null;
  let failed = false;
  try {
    const contact = await resolveGolf(facility);
    if (contact) {
      const opened = reachForAccess(facility.access, contact);
      bookingUrl = opened.bookingUrl;
      phone = opened.phone;
      websiteUrl = contact.websiteUrl;
    }
  } catch {
    failed = true;
  }
  if (websiteUrl && !(bookingUrl && phone)) {
    const site = await readSite(websiteUrl, bookingUrl, phone);
    bookingUrl = site.bookingUrl;
    phone = site.phone;
    failed = site.failed && !bookingUrl && !phone;
  }
  const previous = reach.get(facility.facility_id);
  if (bookingUrl || phone) {
    reach.set(facility.facility_id, {
      facilityId: facility.facility_id,
      bookingUrl,
      phone,
      enabled: previous?.enabled === true,
    });
    trouble.delete(facility.facility_id);
    return;
  }
  reach.delete(facility.facility_id);
  const reason = !websiteUrl ? "no-website" : failed ? "site-failed" : "no-phone-or-booking";
  trouble.set(facility.facility_id, {
    facilityId: facility.facility_id,
    name: facility.official_name,
    province: facility.province,
    reason,
  });
}

const queue = facilities.filter((facility) => {
  if (facility.access === "private") return false;
  if (RETRY) {
    const problem = trouble.get(facility.facility_id);
    return problem?.reason === "site-failed" || problem?.reason === "no-phone-or-booking";
  }
  return !shouldSkip(facility);
});
const work = LIMIT > 0 ? queue.slice(0, LIMIT) : queue;
let finished = 0;
console.log(`scanning ${work.length} public courses`);

let writing = Promise.resolve();
async function checkpoint() {
  writing = writing.then(() => writeFiles());
  await writing;
}

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (work.length > 0) {
      const facility = work.shift();
      if (!facility) return;
      await scanOne(facility);
      finished += 1;
      if (finished % 25 === 0) {
        await checkpoint();
        console.log(`${finished} checked, ${reach.size} reachable, ${trouble.size} trouble`);
      }
    }
  }),
);
await checkpoint();
console.log(`done. ${reach.size} reachable, ${trouble.size} trouble`);
