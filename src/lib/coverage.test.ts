import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coverage, percentageLabel, publicShare } from "./coverage";
import type { Facility, Round } from "./types";

function facility(partial: Partial<Facility> & Pick<Facility, "facilityId" | "province">): Facility {
  return {
    officialName: partial.facilityId,
    place: null,
    latitude: null,
    longitude: null,
    holeCount: 18,
    access: "public",
    associationCourseId: null,
    associationCourseIds: [],
    rating: null,
    slope: null,
    sourceUrl: "https://example.test",
    mergedRoutings: false,
    ...partial,
  };
}

function round(facilityId: string, playedOn: string, holes: 9 | 18 = 18): Round {
  return {
    id: `${facilityId}-${playedOn}-${holes}`,
    userId: "u",
    facilityId,
    playedOn,
    holes,
    score: 80,
    scoreDifferential: null,
    source: "import",
    rawCourseName: null,
    rawAssociationCourseId: null,
  };
}

const facilities = [
  facility({ facilityId: "a", province: "PEI" }),
  facility({ facilityId: "b", province: "PEI", holeCount: 9 }),
  facility({ facilityId: "c", province: "PEI", access: "private" }),
  facility({ facilityId: "d", province: "NS" }),
];

describe("coverage", () => {
  it("reports played of total, split into this year and earlier", () => {
    const result = coverage({
      facilities,
      rounds: [round("a", "2026-06-01"), round("c", "2024-08-01"), round("c", "2026-07-01")],
      denominator: { kind: "province", province: "PEI" },
      year: 2026,
    });
    expect(result).toMatchObject({ played: 2, total: 3, thisYear: 1, earlier: 1 });
    expect(result.thisYear + result.earlier).toBe(result.played);
    expect(percentageLabel(result.percentage)).toBe("67%");
    expect(percentageLabel(1 / 1679)).toBe("<1%");
    expect(percentageLabel(0)).toBe("0%");
  });

  it("counts a facility once when it has many rounds", () => {
    const result = coverage({
      facilities,
      rounds: [round("a", "2026-06-01", 18), round("a", "2026-06-01", 9), round("a", "2025-01-02")],
      denominator: { kind: "province", province: "PEI" },
      year: 2026,
    });
    expect(result.played).toBe(1);
    expect(result.earlier).toBe(1);
    expect(result.thisYear).toBe(0);
  });

  it("keeps an unmatched round out of the percentage", () => {
    const result = coverage({
      facilities,
      rounds: [{ ...round("missing", "2026-06-01"), facilityId: null }],
      denominator: { kind: "province", province: "PEI" },
      year: 2026,
    });
    expect(result.played).toBe(0);
  });

  it("ignores a round that is not 9 or 18 holes", () => {
    const result = coverage({
      facilities,
      rounds: [{ ...round("a", "2026-06-01"), holes: 7 as 9 }],
      denominator: { kind: "canada" },
      year: 2026,
    });
    expect(result.played).toBe(0);
    expect(result.total).toBe(4);
  });

  it("changes the percentage when the denominator changes and does not need the rounds to change", () => {
    const rounds = [round("a", "2026-06-01")];
    const province = coverage({
      facilities,
      rounds,
      denominator: { kind: "province", province: "PEI" },
      year: 2026,
    });
    const canada = coverage({
      facilities,
      rounds,
      denominator: { kind: "canada" },
      year: 2026,
    });
    expect(province).toMatchObject({ played: 1, total: 3 });
    expect(canada).toMatchObject({ played: 1, total: 4 });
    expect(canada.percentage).not.toBe(province.percentage);
  });

  it("applies 18-hole and public filters only as denominator filters", () => {
    const rounds = [round("a", "2026-06-01"), round("b", "2026-06-02", 9), round("c", "2025-05-01")];
    const eighteen = coverage({
      facilities,
      rounds,
      denominator: { kind: "province", province: "PEI" },
      filters: { eighteenHoleOnly: true },
      year: 2026,
    });
    const publicOnly = coverage({
      facilities,
      rounds,
      denominator: { kind: "province", province: "PEI" },
      filters: { publicOnly: true },
      year: 2026,
    });
    expect(eighteen).toMatchObject({ played: 2, total: 2, thisYear: 1, earlier: 1 });
    expect(publicOnly).toMatchObject({ played: 2, total: 2 });
  });

  it("builds a public share with counts and no course names", () => {
    const provincial = coverage({
      facilities,
      rounds: [round("a", "2026-06-01")],
      denominator: { kind: "province", province: "PEI" },
      year: 2026,
    });
    const canada = coverage({
      facilities,
      rounds: [round("a", "2026-06-01")],
      denominator: { kind: "canada" },
      year: 2026,
    });
    const share = publicShare({ headlineProvince: "PEI", provincial, canada });
    expect(share).toEqual({
      headlineProvince: "PEI",
      provincialPlayed: 1,
      provincialTotal: 3,
      provincialPercentage: provincial.percentage,
      canadaPlayed: 1,
      canadaTotal: 4,
      canadaPercentage: canada.percentage,
      firstPlayedThisYear: 1,
    });
    expect(JSON.stringify(share)).not.toMatch(/official|score|course/i);
  });
});

describe("seed layouts", () => {
  const seed = JSON.parse(readFileSync("data/facilities.json", "utf8")) as {
    facilities: Array<{
      facility_id: string;
      official_name: string;
      province: "NS" | "PEI" | "NB" | "NL";
      hole_count: number;
      access: "public" | "private";
      association_course_ids?: string[];
      merged_routings?: boolean;
      source_url: string;
    }>;
  };

  it("counts Pippy Park's 9-hole and 18-hole routings as one facility", () => {
    const pippy = seed.facilities.find((row) => row.facility_id === "nl-pippy-park-golf-course");
    expect(pippy?.merged_routings).toBe(true);
    expect(pippy?.association_course_ids).toEqual(["19102", "19103"]);
    expect(pippy?.hole_count).toBe(18);
    const sameName = seed.facilities.filter((row) => row.official_name === "Pippy Park Golf Course");
    expect(sameName).toHaveLength(1);

    const facilities: Facility[] = [
      facility({
        facilityId: pippy!.facility_id,
        province: "NL",
        officialName: pippy!.official_name,
        holeCount: pippy!.hole_count,
        associationCourseIds: pippy!.association_course_ids ?? [],
        mergedRoutings: true,
      }),
    ];
    const result = coverage({
      facilities,
      rounds: [
        round(pippy!.facility_id, "2026-07-01", 18),
        round(pippy!.facility_id, "2024-07-01", 9),
      ],
      denominator: { kind: "province", province: "NL" },
      year: 2026,
    });
    expect(result).toMatchObject({ played: 1, total: 1, earlier: 1, thisYear: 0 });
  });
});
