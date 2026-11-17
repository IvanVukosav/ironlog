import { describe, expect, it } from "vitest";
import { pickReadingSection } from "./useScrollSpy";

const IDS = ["appearance", "goals", "training", "backup"];

describe("pickReadingSection", () => {
  it("is the first section until one has scrolled up to the reading line", () => {
    expect(pickReadingSection(IDS, [180, 600, 1100, 1500], { readingLine: 140 })).toBe(
      "appearance",
    );
  });

  it("is the last section whose top has reached the reading line", () => {
    expect(pickReadingSection(IDS, [-800, -200, 120, 700], { readingLine: 140 })).toBe("training");
    expect(pickReadingSection(IDS, [-800, 140, 600, 900], { readingLine: 140 })).toBe("goals");
  });

  it("is the last section at the end of the page, even if its top is still low", () => {
    expect(
      pickReadingSection(IDS, [-1600, -900, -300, 400], { readingLine: 140, atEnd: true }),
    ).toBe("backup");
  });

  it("skips a section that is not on the page", () => {
    expect(pickReadingSection(IDS, [-800, undefined, 500, 900], { readingLine: 140 })).toBe(
      "appearance",
    );
  });
});
