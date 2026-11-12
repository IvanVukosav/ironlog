import { describe, expect, it } from "vitest";
import { formatNumber, formatSet, formatVolume, parseDecimal, toDecimalText } from "./numbers";

describe("formatSet", () => {
  it("writes weight, reps and RPE in the language's numbers", () => {
    expect(formatSet({ weight: 102.5, reps: 5, rpe: 8 }, "hr")).toBe("102,5 kg × 5 @ 8");
    expect(formatSet({ weight: 102.5, reps: 5, rpe: 7.5 }, "en")).toBe("102.5 kg × 5 @ 7.5");
  });

  it("leaves out the RPE part when there is none", () => {
    expect(formatSet({ weight: 100, reps: 3, rpe: null }, "hr")).toBe("100 kg × 3");
  });
});

describe("formatNumber", () => {
  it("writes the decimal mark and grouping of the language", () => {
    expect(formatNumber(180, "hr", { decimals: 1 })).toBe("180,0");
    expect(formatNumber(180, "en", { decimals: 1 })).toBe("180.0");
    expect(formatNumber(1234.5, "hr", { decimals: 1 })).toBe("1.234,5");
  });

  it("shows only the decimals a number has, up to two, without a fixed count", () => {
    expect(formatNumber(102.5, "hr")).toBe("102,5");
    expect(formatNumber(100, "hr")).toBe("100");
    expect(formatNumber(92.25, "en")).toBe("92.25");
    expect(formatNumber(1 / 3, "en")).toBe("0.33");
  });
});

describe("formatVolume", () => {
  it("writes tonnes from 1000 kg up and kilograms below", () => {
    expect(formatVolume(48200, "hr")).toBe("48,2 t");
    expect(formatVolume(1000, "en")).toBe("1.0 t");
    expect(formatVolume(850, "hr")).toBe("850 kg");
    expect(formatVolume(0, "hr")).toBe("0 kg");
  });
});

describe("toDecimalText", () => {
  it("turns a decimal comma into a point", () => {
    expect(toDecimalText("102,5")).toBe("102.5");
  });

  it("leaves a point, a whole number and stray text as they are, trimmed", () => {
    expect(toDecimalText(" 102.5 ")).toBe("102.5");
    expect(toDecimalText("100")).toBe("100");
    expect(toDecimalText("pet")).toBe("pet");
  });

  it("gives an empty text for nothing at all", () => {
    expect(toDecimalText("")).toBe("");
    expect(toDecimalText(undefined)).toBe("");
    expect(toDecimalText(null)).toBe("");
  });

  it("takes numbers too, since saved sets come back as numbers", () => {
    expect(toDecimalText(92.5)).toBe("92.5");
  });
});

describe("parseDecimal", () => {
  it("reads a comma the way parseFloat reads a point", () => {
    expect(parseDecimal("102,5")).toBe(102.5);
    expect(parseDecimal("7,5")).toBe(7.5);
    expect(parseDecimal("100")).toBe(100);
  });

  it("is NaN for text without a number", () => {
    expect(parseDecimal("")).toBeNaN();
    expect(parseDecimal("pet")).toBeNaN();
  });
});
