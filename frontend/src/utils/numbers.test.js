import { describe, expect, it } from "vitest";
import { parseDecimal, toDecimalText } from "./numbers";

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
