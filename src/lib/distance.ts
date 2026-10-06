export function distanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earth = 6371;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const PLACES = [
  { id: "vancouver", latitude: 49.2827, longitude: -123.1207 },
  { id: "calgary", latitude: 51.0447, longitude: -114.0719 },
  { id: "edmonton", latitude: 53.5461, longitude: -113.4938 },
  { id: "winnipeg", latitude: 49.8954, longitude: -97.1385 },
  { id: "toronto", latitude: 43.6532, longitude: -79.3832 },
  { id: "ottawa", latitude: 45.4215, longitude: -75.6972 },
  { id: "montreal", latitude: 45.5017, longitude: -73.5673 },
  { id: "quebec", latitude: 46.8139, longitude: -71.208 },
  { id: "halifax", latitude: 44.6488, longitude: -63.5752 },
  { id: "charlottetown", latitude: 46.2382, longitude: -63.1311 },
  { id: "moncton", latitude: 46.0878, longitude: -64.7782 },
  { id: "stjohns", latitude: 47.5615, longitude: -52.7126 },
] as const;

export type PlaceId = (typeof PLACES)[number]["id"];

export function placeById(id: string | undefined): (typeof PLACES)[number] | null {
  return PLACES.find((place) => place.id === id) ?? null;
}
