import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dateKeyOf,
  formatDayMonth,
  formatShortDate,
  formatWeekdayDate,
  toDateKey,
  todayKey,
  todayParts,
} from "./dates";

describe("formatShortDate", () => {
  it("writes day and short month in the language, with the year only when it differs", () => {
    expect(formatShortDate("2026-10-28", "hr", 2026)).toBe("28. lis");
    expect(formatShortDate("2026-10-28", "en", 2026)).toBe("Oct 28");
    expect(formatShortDate("2025-10-28", "hr", 2026)).toBe("28. lis 2025.");
    expect(formatShortDate(Date.UTC(2025, 9, 28), "en", 2026)).toBe("Oct 28, 2025");
  });
});

describe("formatWeekdayDate", () => {
  it("writes the day out, with a capital even in Croatian", () => {
    expect(formatWeekdayDate("2026-11-12", "hr", 2026)).toBe("Četvrtak, 12. studenoga");
    expect(formatWeekdayDate("2026-11-12", "en", 2026)).toBe("Thursday, November 12");
  });

  it("adds the year only when it is not this one", () => {
    expect(formatWeekdayDate("2025-12-31", "hr", 2026)).toBe("Srijeda, 31. prosinca 2025.");
    expect(formatWeekdayDate("2025-12-31", "en", 2026)).toBe("Wednesday, December 31, 2025");
  });

  it("reads the stored UTC day, whatever the clock's time zone", () => {
    expect(formatWeekdayDate("2026-11-04T00:00:00.000Z", "en", 2026)).toBe("Wednesday, November 4");
  });
});

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

describe("todayParts and todayKey", () => {
  afterEach(() => vi.useRealTimers());

  it("follow the local clock, so just after midnight it is already today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 11, 0, 30));
    expect(todayParts()).toEqual({ year: 2026, month: 11, day: 11 });
    expect(todayKey()).toBe("2026-11-11");
  });
});
