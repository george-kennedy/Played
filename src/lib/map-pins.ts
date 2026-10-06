export function hasMapCoordinates<T extends { latitude: number | null; longitude: number | null }>(
  facility: T,
): facility is T & { latitude: number; longitude: number } {
  return (
    typeof facility.latitude === "number" &&
    Number.isFinite(facility.latitude) &&
    typeof facility.longitude === "number" &&
    Number.isFinite(facility.longitude)
  );
}

/** Courses with coordinates become pins. The rest stay in the list with no pin. */
export function splitMapFacilities<T extends { latitude: number | null; longitude: number | null }>(
  facilities: T[],
): { pinned: Array<T & { latitude: number; longitude: number }>; unpinned: T[] } {
  const pinned: Array<T & { latitude: number; longitude: number }> = [];
  const unpinned: T[] = [];
  for (const facility of facilities) {
    if (hasMapCoordinates(facility)) pinned.push(facility);
    else unpinned.push(facility);
  }
  return { pinned, unpinned };
}
