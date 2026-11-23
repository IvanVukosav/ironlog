import { describe, expect, it } from "vitest";
import { expandUpcE, normalizeBarcode } from "./barcode";

describe("normalizeBarcode", () => {
  it("takes EAN-13, EAN-8 and GTIN-14 whose check digit fits, as they are", () => {
    expect(normalizeBarcode("4006381333931")).toBe("4006381333931");
    expect(normalizeBarcode("96385074")).toBe("96385074");
    expect(normalizeBarcode("10012345678902")).toBe("10012345678902");
  });

  it("keeps a UPC-A as its EAN-13, with a 0 in front, as the backend does", () => {
    expect(normalizeBarcode("036000291452")).toBe("0036000291452");
  });

  it("drops spaces and dashes typed between the digits", () => {
    expect(normalizeBarcode(" 400 6381-333931 ")).toBe("4006381333931");
  });

  it("writes out a UPC-E, when the camera says so or when eight digits are no EAN-8", () => {
    expect(normalizeBarcode("04252614", "upc_e")).toBe("0042100005264");
    expect(normalizeBarcode("04252614")).toBe("0042100005264");
  });

  it("refuses a wrong check digit, other lengths and anything that isn't digits", () => {
    for (const bad of ["4006381333932", "9638507", "123456789", "40063813339x1", "", null]) {
      expect(normalizeBarcode(bad), String(bad)).toBeNull();
    }
  });
});

describe("expandUpcE", () => {
  it("writes each kind of UPC-E out by its sixth digit", () => {
    expect(expandUpcE("04252614")).toBe("042100005264");
    expect(expandUpcE("01234533")).toBe("012300000453");
    expect(expandUpcE("01234543")).toBe("012340000053");
    expect(expandUpcE("01234573")).toBe("012345000073");
    expect(expandUpcE("21234573")).toBeNull();
  });
});
