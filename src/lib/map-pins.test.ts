import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { splitMapFacilities } from "./map-pins";

describe("splitMapFacilities", () => {
  it("keeps a course with coordinates and drops a course missing either one", () => {
    const { pinned, unpinned } = splitMapFacilities([
      { id: "pin", latitude: 44.6, longitude: -63.6 },
      { id: "none", latitude: null, longitude: null },
      { id: "lat-only", latitude: 46, longitude: null },
      { id: "lng-only", latitude: null, longitude: -60 },
    ]);
    expect(pinned.map((item) => item.id)).toEqual(["pin"]);
    expect(unpinned.map((item) => item.id)).toEqual(["none", "lat-only", "lng-only"]);
    expect(pinned.length + unpinned.length).toBe(4);
  });

  it("gives every seed course a map pin", () => {
    const seed = JSON.parse(readFileSync(path.join(process.cwd(), "data", "facilities.json"), "utf8")) as {
      facilities: Array<{ official_name: string; latitude?: number; longitude?: number }>;
    };
    const facilities = seed.facilities.map((row) => ({
      officialName: row.official_name,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
    }));
    const { pinned, unpinned } = splitMapFacilities(facilities);
    expect(unpinned).toEqual([]);
    expect(pinned).toHaveLength(facilities.length);
    expect(pinned.every((facility) => Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude))).toBe(
      true,
    );
  });
});
