import { describe, expect, it } from "vitest";
import { dateKeyOf, formatDayMonth, toDateKey } from "./dates";

describe("formatDayMonth", () => {
  it("shows day/month without leading zeros, from a string or a timestamp", () => {
    expect(formatDayMonth("2026-11-04T00:00:00.000Z")).toBe("4/11");
    expect(formatDayMonth(Date.UTC(2026, 0, 9))).toBe("9/1");
  });
});

describe("toDateKey and dateKeyOf", () => {
  it("pad month and day to the API's YYYY-MM-DD", () => {
    expect(toDateKey(2026, 3, 7)).toBe("2026-03-07");
    expect(dateKeyOf(new Date(Date.UTC(2026, 10, 4)))).toBe("2026-11-04");
  });

  it("use the UTC day, not the local one", () => {
    // 23:30 UTC is already the next day in Croatia, but the stored day is still the 4th.
    expect(dateKeyOf(new Date("2026-11-04T23:30:00.000Z"))).toBe("2026-11-04");
  });
});
