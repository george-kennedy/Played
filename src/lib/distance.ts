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
  { id: "halifax", latitude: 44.6488, longitude: -63.5752 },
  { id: "charlottetown", latitude: 46.2382, longitude: -63.1311 },
  { id: "moncton", latitude: 46.0878, longitude: -64.7782 },
  { id: "stjohns", latitude: 47.5615, longitude: -52.7126 },
] as const;

export type PlaceId = (typeof PLACES)[number]["id"];

export function placeById(id: string | undefined): (typeof PLACES)[number] | null {
  return PLACES.find((place) => place.id === id) ?? null;
}
