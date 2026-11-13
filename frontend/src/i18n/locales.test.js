import { describe, expect, it } from "vitest";
import i18n from "./index";
import hr from "./locales/hr.json";
import en from "./locales/en.json";

// Plural keys end in a form ("_one", "_few", ...); a language only has the forms it uses.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function keysOf(messages, prefix = "") {
  return Object.entries(messages).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? keysOf(value, `${prefix}${key}.`)
      : [`${prefix}${key}`.replace(PLURAL_SUFFIX, "")],
  );
}

describe("locales", () => {
  it("have the same messages in Croatian and English", () => {
    expect([...new Set(keysOf(hr))].sort()).toEqual([...new Set(keysOf(en))].sort());
  });

  it("count in Croatian with its one, few and other forms", () => {
    const t = i18n.getFixedT("hr");
    expect([1, 2, 5, 21, 22].map((count) => t("dashboard.exerciseCount", { count }))).toEqual([
      "1 vježba",
      "2 vježbe",
      "5 vježbi",
      "21 vježba",
      "22 vježbe",
    ]);
    expect(t("dashboard.setCount", { count: 3 })).toBe("3 seta");
    expect(t("dashboard.streakDays", { count: 1 })).toBe("1 dan zaredom");
    expect(t("dashboard.streakDays", { count: 0 })).toBe("0 dana zaredom");
  });

  it("count in English with one and other", () => {
    const t = i18n.getFixedT("en");
    expect(t("dashboard.exerciseCount", { count: 1 })).toBe("1 exercise");
    expect(t("dashboard.exerciseCount", { count: 3 })).toBe("3 exercises");
    expect(t("dashboard.workoutWord", { count: 0 })).toBe("workouts");
  });
});
