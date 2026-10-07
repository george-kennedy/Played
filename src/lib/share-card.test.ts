import { describe, expect, it } from "vitest";
import { shareCardSvg, shareStorySvg } from "./share-card";

const sample = {
  brand: "Played",
  provinceLabel: "Nova Scotia",
  provincePercent: "18%",
  provinceCount: "10 of 57",
  canadaLabel: "of Canada's courses",
  canadaPercent: "12%",
  canadaCount: "200 of 1679",
  firstLine: "4 facilities first played this year",
  tagline: "A Canada golf atlas",
};

describe("share graphics", () => {
  it("builds a landscape preview and a story image with escaped text", () => {
    const card = shareCardSvg({ ...sample, brand: "Played & Co" });
    expect(card).toContain('width="1200"');
    expect(card).toContain("Played &amp; Co");
    expect(card).toContain("12%");
    const story = shareStorySvg(sample);
    expect(story).toContain('height="1920"');
    expect(story).toContain("Nova Scotia");
  });
});
