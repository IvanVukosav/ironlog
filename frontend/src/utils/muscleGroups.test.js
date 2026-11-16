import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { MUSCLE_GROUPS, muscleGroupLabel } from "./muscleGroups";

describe("muscleGroupLabel", () => {
  it("shows the saved Croatian groups in English, and in Croatian as saved", () => {
    const en = i18n.getFixedT("en");
    const hr = i18n.getFixedT("hr");
    expect(MUSCLE_GROUPS.map((group) => muscleGroupLabel(group, en))).toEqual([
      "Back",
      "Chest",
      "Quads",
      "Hamstrings",
      "Shoulders",
      "Glutes",
      "Arms",
      "Abs",
    ]);
    expect(muscleGroupLabel("Ostalo", en)).toBe("Other");
    expect(MUSCLE_GROUPS.map((group) => muscleGroupLabel(group, hr))).toEqual(MUSCLE_GROUPS);
  });

  it("shows a group of one's own as it was saved", () => {
    expect(muscleGroupLabel("Podlaktice", i18n.getFixedT("en"))).toBe("Podlaktice");
  });
});
