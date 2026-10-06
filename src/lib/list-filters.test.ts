import { describe, expect, it } from "vitest";
import { matchesHoles, matchesRanking } from "./list-filters";
import rankings from "../../data/rankings.json";

describe("matchesRanking", () => {
  it("keeps every course when no list is chosen", () => {
    expect(matchesRanking("missing", "")).toBe(true);
  });

  it("uses the stored national and public lists", () => {
    const nationalId = rankings.national[0];
    const publicId = rankings.public[0];
    expect(matchesRanking(nationalId, "national")).toBe(true);
    expect(matchesRanking("not-a-course", "national")).toBe(false);
    expect(matchesRanking(publicId, "public")).toBe(true);
  });
});

describe("matchesHoles", () => {
  it("treats 9-hole as shorter than 18 and 18-hole as 18 or more", () => {
    expect(matchesHoles(9, "9")).toBe(true);
    expect(matchesHoles(18, "9")).toBe(false);
    expect(matchesHoles(18, "18")).toBe(true);
    expect(matchesHoles(27, "18")).toBe(true);
    expect(matchesHoles(9, "")).toBe(true);
  });
});
