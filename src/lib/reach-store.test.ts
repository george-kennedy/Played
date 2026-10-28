import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type ReachRow = {
  facilityId: string;
  bookingUrl: string | null;
  phone: string | null;
  enabled: boolean;
};

describe("reach launch data", () => {
  const file = JSON.parse(readFileSync(path.join(process.cwd(), "data", "reach.json"), "utf8")) as {
    courses: ReachRow[];
  };

  it("enables every public course that has a booking link or phone", () => {
    expect(file.courses.length).toBeGreaterThan(1000);
    const enabled = file.courses.filter((row) => row.enabled);
    expect(enabled.length).toBe(file.courses.length);
    expect(file.courses.every((row) => row.bookingUrl || row.phone)).toBe(true);
  });

  it("includes curated Cabot Cape Breton booking", () => {
    for (const id of ["ns-cabot-cliffs", "ns-cabot-links", "ns-cabot-the-nest"]) {
      const row = file.courses.find((course) => course.facilityId === id);
      expect(row?.enabled).toBe(true);
      expect(row?.bookingUrl).toContain("cabot.com");
      expect(row?.phone).toBe("(855) 652-2268");
    }
  });
});
