/** Plain copy of the reach parsers in src/lib/course-media.ts, for the scan script. */

const TEE_SHEET_HOSTS = [
  "chronogolf.com",
  "chronogolf.ca",
  "lightspeedhq.com",
  "golfnow.com",
  "teeoff.com",
  "foreupsoftware.com",
  "prophetservices.com",
  "cps.golf",
  "supremegolf.com",
  "quick18.com",
  "ezlinks.com",
  "teeitup.com",
  "teeitup.golf",
  "tee-on.com",
  "golfback.com",
];

function normalizeName(value) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function httpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

export function canadianPhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(local)) return null;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

export function isTeeSheetUrl(value) {
  const url = httpUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return TEE_SHEET_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
}

function originOf(value) {
  const url = httpUrl(value);
  if (!url) return null;
  return `${url.origin}/`;
}

export function golfContact(payload, officialName) {
  const data = record(record(payload)?.data);
  if (!data) return null;
  const name = typeof data.facilityName === "string" ? data.facilityName : "";
  if (normalizeName(name) !== normalizeName(officialName)) return null;
  const tee = httpUrl(data.teeTimeUrl);
  const site = originOf(data.url) ?? originOf(data.greenFeeUrl);
  const websiteUrl = site ?? (tee && !isTeeSheetUrl(tee.toString()) ? `${tee.origin}/` : null);
  const courses = Array.isArray(data.courses) ? data.courses : [];
  const coursePhone = record(courses[0])?.phone;
  const phone = canadianPhone(data.phone) ?? canadianPhone(typeof coursePhone === "string" ? coursePhone : null);
  return { websiteUrl, bookingUrl: tee ? tee.toString() : null, phone };
}

function matchedSearchRow(payload, officialName) {
  const body = record(payload);
  const rows = Array.isArray(body?.data) ? body.data : [];
  const wanted = normalizeName(officialName);
  for (const row of rows) {
    const item = record(row);
    if (item && normalizeName(typeof item.name === "string" ? item.name : "") === wanted) return item;
  }
  return null;
}

export function outdoorIdFromSearch(payload, officialName) {
  const outdoor = record(matchedSearchRow(payload, officialName)?.outdoor_details);
  const id = outdoor?.id;
  if (typeof id === "number" || (typeof id === "string" && id.trim())) return String(id);
  return null;
}

function followPath(pathname) {
  return /tee-?times?|reserv|contact|book/i.test(pathname);
}

export function parseClubPage(html, pageUrl) {
  const base = httpUrl(pageUrl);
  let bookingUrl = null;
  let phone = null;
  let teeFollow = null;
  let contactFollow = null;
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const raw = match[1].trim().replace(/&amp;/g, "&");
    if (!phone && raw.toLowerCase().startsWith("tel:")) {
      phone = canadianPhone(decodeURIComponent(raw.slice(4).split("?")[0] ?? ""));
    }
    if (!base) continue;
    let absolute;
    try {
      absolute = new URL(raw, base);
    } catch {
      continue;
    }
    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") continue;
    if (!bookingUrl && isTeeSheetUrl(absolute.toString())) bookingUrl = absolute.toString();
    if (absolute.origin !== base.origin || absolute.toString() === base.toString()) continue;
    if (!followPath(absolute.pathname)) continue;
    if (/tee-?times?|reserv|book/i.test(absolute.pathname)) teeFollow ??= absolute.toString();
    else contactFollow ??= absolute.toString();
  }
  return { bookingUrl, phone, followUrl: bookingUrl && phone ? null : (teeFollow ?? contactFollow) };
}

export function reachForAccess(access, found) {
  if (access === "private") return { bookingUrl: null, phone: null };
  return { bookingUrl: found.bookingUrl, phone: found.phone };
}
