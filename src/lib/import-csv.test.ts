import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coverage } from "./coverage";
import { confirmFacility, importCsv, matchFacility } from "./import-csv";
import type { Facility } from "./types";

const seed = JSON.parse(readFileSync("data/facilities.json", "utf8")) as {
  facilities: Array<{
    facility_id: string;
    official_name: string;
    province: Facility["province"];
    place?: string | null;
    latitude?: number;
    longitude?: number;
    hole_count: number;
    access: Facility["access"];
    association_course_id?: string;
    association_course_ids?: string[];
    rating?: number;
    slope?: number;
    source_url: string;
    merged_routings?: boolean;
  }>;
};

function toFacility(row: (typeof seed.facilities)[number]): Facility {
  return {
    facilityId: row.facility_id,
    officialName: row.official_name,
    province: row.province,
    place: row.place ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    holeCount: row.hole_count,
    access: row.access,
    associationCourseId: row.association_course_id ?? null,
    associationCourseIds: row.association_course_ids ?? [],
    rating: row.rating ?? null,
    slope: row.slope ?? null,
    sourceUrl: row.source_url,
    mergedRoutings: Boolean(row.merged_routings),
  };
}

const facilities = seed.facilities.map(toFacility);
const pippy = facilities.find((facility) => facility.facilityId === "nl-pippy-park-golf-course")!;

let sequence = 0;
function newId(): string {
  sequence += 1;
  return `id-${sequence}`;
}

describe("csv import", () => {
  it("keeps a valid row, rejects a bad date, and leaves an unknown name unmatched", () => {
    const csv = [
      "played_on,course_name,holes,association_course_id,score,score_differential",
      "2026-06-01,Pippy Park Golf Course,18,,80,10.2",
      "2026-13-01,Pippy Park Golf Course,18,,81,",
      "2024-05-02,Not A Real Club,9,,70,",
    ].join("\n");
    const result = importCsv({ csv, facilities, existing: [], userId: "u", newId });
    expect(result.acceptedMatched).toBe(1);
    expect(result.failures.map((failure) => failure.reason)).toEqual(["bad_date"]);
    expect(result.unmatched).toEqual([
      { line: 4, courseName: "Not A Real Club", playedOn: "2024-05-02", holes: 9 },
    ]);
    expect(result.toInsert.find((round) => round.rawCourseName === "Not A Real Club")?.facilityId).toBeNull();
    const played = coverage({
      facilities,
      rounds: result.toInsert,
      denominator: { kind: "province", province: "NL" },
      year: 2026,
    });
    expect(played.played).toBe(1);
    expect(confirmFacility(facilities, "not-in-the-seed")).toBeNull();
    expect(matchFacility(facilities, "Not A Real Club", "")).toBeNull();
  });

  it("matches either Pippy Park routing id to the one facility", () => {
    const csv = [
      "played_on,course_name,holes,association_course_id,score,score_differential",
      "2026-06-01,something else,18,19102,80,",
      "2024-06-01,Captain's Hill,9,19103,40,",
    ].join("\n");
    const result = importCsv({ csv, facilities, existing: [], userId: "u", newId });
    expect(result.acceptedMatched).toBe(2);
    expect(new Set(result.toInsert.map((round) => round.facilityId))).toEqual(new Set([pippy.facilityId]));
    const played = coverage({
      facilities: [pippy],
      rounds: result.toInsert,
      denominator: { kind: "province", province: "NL" },
      year: 2026,
    });
    expect(played).toMatchObject({ played: 1, total: 1, thisYear: 0, earlier: 1 });
  });

  it("does not duplicate a re-import and does not overwrite a conflicting score", () => {
    const header = "played_on,course_name,holes,association_course_id,score,score_differential";
    const first = importCsv({
      csv: `${header}\n2026-06-01,Pippy Park Golf Course,18,,80,10`,
      facilities,
      existing: [],
      userId: "u",
      newId,
    });
    const again = importCsv({
      csv: `${header}\n2026-06-01,Pippy Park Golf Course,18,,80,10`,
      facilities,
      existing: first.toInsert,
      userId: "u",
      newId,
    });
    expect(again.toInsert).toHaveLength(0);
    expect(again.duplicates).toBe(1);
    const conflict = importCsv({
      csv: `${header}\n2026-06-01,Pippy Park Golf Course,18,,99,22`,
      facilities,
      existing: first.toInsert,
      userId: "u",
      newId,
    });
    expect(conflict.toInsert).toHaveLength(0);
    expect(conflict.failures[0]?.reason).toBe("conflict");
    expect(first.toInsert[0]?.score).toBe(80);
  });

  it("matches a normalized official name and not a partial name", () => {
    expect(matchFacility(facilities, "  pippy   park golf course ", "")?.facilityId).toBe(pippy.facilityId);
    expect(matchFacility(facilities, "Pippy Park", "")).toBeNull();
  });
});
