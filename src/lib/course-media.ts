import { normalizeName } from "./names";

export type CourseMedia = {
  photoUrl: string | null;
  websiteUrl: string | null;
  bookingUrl: string | null;
};

const EMPTY: CourseMedia = { photoUrl: null, websiteUrl: null, bookingUrl: null };

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
  return { photoUrl: photoUrl(photo), ...linksFrom(site, booking) };
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
