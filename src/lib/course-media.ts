import { normalizeName } from "./names";

export type CourseMedia = {
  photoUrl: string | null;
  websiteUrl: string | null;
  bookingUrl: string | null;
  phone: string | null;
};

export type ClubContact = {
  websiteUrl: string | null;
  bookingUrl: string | null;
  phone: string | null;
};

export type PageReach = {
  bookingUrl: string | null;
  phone: string | null;
  followUrl: string | null;
};

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

const EMPTY: CourseMedia = { photoUrl: null, websiteUrl: null, bookingUrl: null, phone: null };

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function httpUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function hostedImage(value: unknown): string | null {
  const url = httpUrl(value);
  if (!url || url.hostname !== "scg.golfcanada.ca") return null;
  return url.toString();
}

/** Course photos from the public facility file. Logos are not photos. */
export function photoUrl(value: unknown): string | null {
  const url = hostedImage(value);
  if (!url || url.toLowerCase().includes("/logo/")) return null;
  return url;
}

function logoUrl(value: unknown): string | null {
  const url = hostedImage(value);
  if (!url || !url.toLowerCase().includes("/logo/")) return null;
  return url;
}

function linksFrom(siteValue: unknown, bookingValue: unknown): Pick<CourseMedia, "websiteUrl" | "bookingUrl"> {
  const site = httpUrl(siteValue);
  const booking = httpUrl(bookingValue);
  if (site) {
    const websiteUrl = site.toString();
    const bookingUrl = booking && booking.toString() !== websiteUrl ? booking.toString() : null;
    return { websiteUrl, bookingUrl };
  }
  if (!booking) return { websiteUrl: null, bookingUrl: null };
  const websiteUrl = `${booking.origin}/`;
  const bookingUrl = booking.toString() === websiteUrl ? null : booking.toString();
  return { websiteUrl, bookingUrl };
}

function media(photo: unknown, site: unknown, booking: unknown): CourseMedia {
  return { photoUrl: photoUrl(photo), phone: null, ...linksFrom(site, booking) };
}

export function mediaFromDetail(payload: unknown, officialName: string): CourseMedia | null {
  const body = record(payload);
  const data = record(body?.data);
  if (!data) return null;
  const name = typeof data.facilityName === "string" ? data.facilityName : "";
  if (normalizeName(name) !== normalizeName(officialName)) return null;
  return media(data.imagePath, data.url, data.teeTimeUrl);
}

function matchedSearchRow(payload: unknown, officialName: string): Record<string, unknown> | null {
  const body = record(payload);
  const rows = Array.isArray(body?.data) ? body.data : [];
  const wanted = normalizeName(officialName);
  for (const row of rows) {
    const item = record(row);
    if (item && normalizeName(typeof item.name === "string" ? item.name : "") === wanted) return item;
  }
  return null;
}

export function outdoorIdFromSearch(payload: unknown, officialName: string): string | null {
  const outdoor = record(matchedSearchRow(payload, officialName)?.outdoor_details);
  const id = outdoor?.id;
  if (typeof id === "number" || (typeof id === "string" && id.trim())) return String(id);
  return null;
}

export function logoFromDetail(payload: unknown, officialName: string): string | null {
  const body = record(payload);
  const data = record(body?.data);
  if (!data) return null;
  const name = typeof data.facilityName === "string" ? data.facilityName : "";
  if (normalizeName(name) !== normalizeName(officialName)) return null;
  return logoUrl(data.logoPath);
}

export function logoFromSearch(payload: unknown, officialName: string): string | null {
  const item = matchedSearchRow(payload, officialName);
  if (!item) return null;
  const outdoor = record(item.outdoor_details);
  return logoUrl(outdoor?.logo_url) ?? logoUrl(item.image);
}

export function mediaFromSearch(payload: unknown, officialName: string): CourseMedia {
  const item = matchedSearchRow(payload, officialName);
  if (!item) return EMPTY;
  const outdoor = record(item.outdoor_details);
  return media(outdoor?.image_url ?? item.image, outdoor?.url ?? item.url, outdoor?.tee_time_url);
}

/** A North American number with a 10-digit local part, shown as (902) 466-7688. */
export function canadianPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(local)) return null;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

export function phoneHref(display: string): string {
  return `tel:+1${display.replace(/\D/g, "")}`;
}

export function isTeeSheetUrl(value: string): boolean {
  const url = httpUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return TEE_SHEET_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
}

function originOf(value: unknown): string | null {
  const url = httpUrl(value);
  if (!url) return null;
  return `${url.origin}/`;
}

/**
 * Golf Canada is used to find the club site and, when present, its tee-time URL.
 * A green-fees page is not treated as online booking.
 */
export function golfContact(payload: unknown, officialName: string): ClubContact | null {
  const data = record(record(payload)?.data);
  if (!data) return null;
  const name = typeof data.facilityName === "string" ? data.facilityName : "";
  if (normalizeName(name) !== normalizeName(officialName)) return null;
  const tee = httpUrl(data.teeTimeUrl);
  const site = originOf(data.url) ?? originOf(data.greenFeeUrl);
  const websiteUrl = site ?? (tee && !isTeeSheetUrl(tee.toString()) ? `${tee.origin}/` : null);
  const courses = Array.isArray(data.courses) ? data.courses : [];
  const coursePhone = record(courses[0])?.phone;
  const phone =
    canadianPhone(data.phone) ?? canadianPhone(typeof coursePhone === "string" ? coursePhone : null);
  return { websiteUrl, bookingUrl: tee ? tee.toString() : null, phone };
}

function followPath(pathname: string): boolean {
  return /tee-?times?|reserv|contact|book/i.test(pathname);
}

/** Read a tee-sheet link and a tel: link from one HTML page. A fees page is not a booking link. */
export function parseClubPage(html: string, pageUrl: string): PageReach {
  const base = httpUrl(pageUrl);
  let bookingUrl: string | null = null;
  let phone: string | null = null;
  let teeFollow: string | null = null;
  let contactFollow: string | null = null;
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const raw = match[1].trim().replace(/&amp;/g, "&");
    if (!phone && raw.toLowerCase().startsWith("tel:")) {
      phone = canadianPhone(decodeURIComponent(raw.slice(4).split("?")[0] ?? ""));
    }
    if (!base) continue;
    let absolute: URL;
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
  const followUrl = bookingUrl && phone ? null : teeFollow ?? contactFollow;
  return { bookingUrl, phone, followUrl };
}

/** Private courses never expose a booking link or a phone number. */
export function reachForAccess(
  access: string,
  found: { bookingUrl: string | null; phone: string | null },
): { bookingUrl: string | null; phone: string | null } {
  if (access === "private") return { bookingUrl: null, phone: null };
  return { bookingUrl: found.bookingUrl, phone: found.phone };
}

export function shownReach(
  access: string,
  reach: { bookingUrl: string | null; phone: string | null; enabled: boolean } | null,
  featureOn: boolean,
): { bookingUrl: string | null; phone: string | null } {
  const empty = { bookingUrl: null, phone: null };
  if (!featureOn || access === "private" || !reach?.enabled) return empty;
  if (reach.bookingUrl) return { bookingUrl: reach.bookingUrl, phone: null };
  if (reach.phone) return { bookingUrl: null, phone: reach.phone };
  return empty;
}

export function bookingFeatureOn(): boolean {
  return process.env.BOOKING_ENABLED === "1";
}

async function reachable(url: string | null): Promise<boolean> {
  if (!url) return false;
  try {
    const response = await fetch(url, { method: "HEAD", next: { revalidate: 86_400 }, signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function withWorkingImage(media: CourseMedia, logo: string | null): Promise<CourseMedia> {
  if (await reachable(media.photoUrl)) return media;
  if (await reachable(logo)) return { ...media, photoUrl: logo };
  return { ...media, photoUrl: null };
}

export async function loadCourseMedia(facility: {
  officialName: string;
  latitude: number | null;
  longitude: number | null;
  associationCourseId: string | null;
}): Promise<CourseMedia> {
  try {
    if (facility.associationCourseId) {
      const detail = await readJson(
        `https://api.golfcanada.ca/api/v1/facilities/${encodeURIComponent(facility.associationCourseId)}`,
      );
      const matched = mediaFromDetail(detail, facility.officialName);
      if (matched) return withWorkingImage(matched, logoFromDetail(detail, facility.officialName));
    }
    if (facility.latitude == null || facility.longitude == null) return EMPTY;
    const search = await readJson(
      `https://api.golfcanada.ca/api/v1/facilities/search?latitude=${facility.latitude}&longitude=${facility.longitude}&sort_by=distance&per_page=8&page=1&facilitySearchType=All`,
    );
    const outdoorId = outdoorIdFromSearch(search, facility.officialName);
    if (outdoorId && outdoorId !== facility.associationCourseId) {
      const detail = await readJson(`https://api.golfcanada.ca/api/v1/facilities/${encodeURIComponent(outdoorId)}`);
      const matched = mediaFromDetail(detail, facility.officialName);
      if (matched) return withWorkingImage(matched, logoFromDetail(detail, facility.officialName));
    }
    return withWorkingImage(mediaFromSearch(search, facility.officialName), logoFromSearch(search, facility.officialName));
  } catch {
    return EMPTY;
  }
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;
  return response.json() as Promise<unknown>;
}
