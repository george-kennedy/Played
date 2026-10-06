import { describe, expect, it } from "vitest";
import { coverage } from "./coverage";
import { isPlayed, toggleMark } from "./mark";
import type { Facility, Round } from "./types";

function round(partial: Partial<Round> & Pick<Round, "id" | "source" | "playedOn">): Round {
  return {
    userId: "u",
    facilityId: "course",
    holes: 18,
    score: partial.source === "import" ? 82 : null,
    scoreDifferential: null,
    rawCourseName: null,
    rawAssociationCourseId: null,
    ...partial,
  };
}

const facilities: Facility[] = [
  {
    facilityId: "course",
    officialName: "Course",
    province: "NS",
    place: "Halifax",
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
  },
  {
    facilityId: "other",
    officialName: "Other",
    province: "NS",
    place: null,
    latitude: null,
    longitude: null,
    holeCount: 9,
    access: "public",
    associationCourseId: null,
    associationCourseIds: [],
    rating: null,
    slope: null,
    sourceUrl: "https://example.test",
    mergedRoutings: false,
  },
];

describe("mark toggle", () => {
  it("records one round dated today and raises the provincial percentage", () => {
    const before = coverage({
      facilities,
      rounds: [],
      denominator: { kind: "province", province: "NS" },
      year: 2026,
    });
    const toggled = toggleMark({
      rounds: [],
      facilityId: "course",
      facilityHoleCount: 18,
      today: "2026-10-06",
      turnOn: true,
      userId: "u",
      newId: "mark-1",
    });
    expect(toggled.created).toMatchObject({
      source: "mark",
      playedOn: "2026-10-06",
      holes: 18,
      facilityId: "course",
      score: null,
    });
    const after = coverage({
      facilities,
      rounds: toggled.created ? [toggled.created] : [],
      denominator: { kind: "province", province: "NS" },
      year: 2026,
    });
    expect(before.played).toBe(0);
    expect(after).toMatchObject({ played: 1, total: 2, thisYear: 1 });
    expect(isPlayed(toggled.created ? [toggled.created] : [], "course")).toBe(true);
  });

  it("uses 9 holes when the facility's longest routing is 9", () => {
    const toggled = toggleMark({
      rounds: [],
      facilityId: "other",
      facilityHoleCount: 9,
      today: "2026-10-06",
      turnOn: true,
      userId: "u",
      newId: "mark-9",
    });
    expect(toggled.created?.holes).toBe(9);
  });

  it("removes only the marked round and leaves an imported round played", () => {
    const imported = round({ id: "imp", source: "import", playedOn: "2024-05-01", score: 90 });
    const on = toggleMark({
      rounds: [imported],
      facilityId: "course",
      facilityHoleCount: 18,
      today: "2026-10-06",
      turnOn: true,
      userId: "u",
      newId: "mark-1",
    });
    const withMark = on.created ? [imported, on.created] : [imported];
    const off = toggleMark({
      rounds: withMark,
      facilityId: "course",
      facilityHoleCount: 18,
      today: "2026-10-06",
      turnOn: false,
      userId: "u",
      newId: "unused",
    });
    expect(off.removedIds).toEqual(["mark-1"]);
    const remaining = withMark.filter((item) => !off.removedIds.includes(item.id));
    expect(remaining).toEqual([imported]);
    expect(isPlayed(remaining, "course")).toBe(true);
    const result = coverage({
      facilities,
      rounds: remaining,
      denominator: { kind: "province", province: "NS" },
      year: 2026,
    });
    expect(result).toMatchObject({ played: 1, earlier: 1, thisYear: 0 });
  });

  it("drops the course from played when the marked round was the only round", () => {
    const on = toggleMark({
      rounds: [],
      facilityId: "course",
      facilityHoleCount: 18,
      today: "2026-10-06",
      turnOn: true,
      userId: "u",
      newId: "mark-1",
    });
    const rounds = on.created ? [on.created] : [];
    const off = toggleMark({
      rounds,
      facilityId: "course",
      facilityHoleCount: 18,
      today: "2026-10-06",
      turnOn: false,
      userId: "u",
      newId: "unused",
    });
    const remaining = rounds.filter((item) => !off.removedIds.includes(item.id));
    expect(remaining).toHaveLength(0);
    expect(
      coverage({
        facilities,
        rounds: remaining,
        denominator: { kind: "province", province: "NS" },
        year: 2026,
      }).played,
    ).toBe(0);
  });
});
