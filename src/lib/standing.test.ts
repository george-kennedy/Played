import { describe, expect, it } from "vitest";
import {
  bandLabel,
  courseComparison,
  handicapBand,
  shiftIsoDate,
  type ComparisonRound,
} from "./standing";

function rounds(userId: string, differential: number | null, count: number, playedOn = "2026-03-01"): ComparisonRound[] {
  return Array.from({ length: count }, () => ({
    userId,
    playedOn,
    holes: 18 as const,
    differential,
  }));
}

describe("standing and Suited", () => {
  it("places an index in a band", () => {
    expect(handicapBand(9.9)).toBe("0-9");
    expect(handicapBand(10)).toBe("10-18");
    expect(handicapBand(18.9)).toBe("10-18");
    expect(handicapBand(19)).toBe("19-28");
    expect(handicapBand(29)).toBe("29+");
    expect(bandLabel("10-18")).toBe("10–18");
    expect(shiftIsoDate("2026-10-06", -24)).toBe("2024-10-06");
  });

  it("hides both numbers until the sample floors are met", () => {
    const indexes = new Map<string, number>();
    const history: ComparisonRound[] = [];
    for (let index = 0; index < 29; index += 1) {
      const userId = `g${index}`;
      indexes.set(userId, 12);
      history.push(...rounds(userId, 10, 8));
    }
    const hidden = courseComparison({
      viewerId: "me",
      viewerIndex: 14,
      rounds: [...history, ...rounds("me", 4, 1)],
      indexes,
      today: "2026-10-06",
    });
    expect(hidden.standing).toBeNull();
    expect(hidden.suited?.count).toBe(29);

    const fewIndexes = new Map<string, number>();
    const few: ComparisonRound[] = [];
    for (let index = 0; index < 24; index += 1) {
      fewIndexes.set(`f${index}`, 12);
      few.push(...rounds(`f${index}`, null, 1));
    }
    const quiet = courseComparison({
      viewerId: "me",
      viewerIndex: 14,
      rounds: few,
      indexes: fewIndexes,
      today: "2026-10-06",
    });
    expect(quiet).toEqual({ standing: null, suited: null });
  });

  it("ranks the viewer inside the band and leaves a golfer without an index out", () => {
    const indexes = new Map<string, number>();
    const history: ComparisonRound[] = [...rounds("me", 4, 2)];
    for (let index = 0; index < 31; index += 1) {
      const userId = `g${index}`;
      indexes.set(userId, index === 0 ? 4 : 15);
      history.push(...rounds(userId, index === 0 ? 1 : 12, 8));
    }
    const shown = courseComparison({
      viewerId: "me",
      viewerIndex: 14.2,
      rounds: history,
      indexes,
      today: "2026-10-06",
    });
    expect(shown.standing).toEqual({ percent: 100, band: "10-18", count: 30 });
    expect(shown.suited?.count).toBe(30);

    const noIndex = courseComparison({
      viewerId: "me",
      viewerIndex: null,
      rounds: history,
      indexes,
      today: "2026-10-06",
    });
    expect(noIndex).toEqual({ standing: null, suited: null });
  });
});
