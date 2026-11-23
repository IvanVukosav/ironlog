const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBarcode } = require("./barcode");

test("normalizeBarcode takes EAN-13, EAN-8 and GTIN-14 whose check digit fits", () => {
  assert.equal(normalizeBarcode("4006381333931"), "4006381333931");
  assert.equal(normalizeBarcode("3017620422003"), "3017620422003");
  assert.equal(normalizeBarcode("96385074"), "96385074");
  assert.equal(normalizeBarcode("10012345678902"), "10012345678902");
});

test("normalizeBarcode keeps a UPC-A as its EAN-13, with a 0 in front", () => {
  assert.equal(normalizeBarcode("036000291452"), "0036000291452");
});

test("normalizeBarcode drops spaces and dashes typed between the digits", () => {
  assert.equal(normalizeBarcode(" 400 6381-333931 "), "4006381333931");
});

test("normalizeBarcode refuses a wrong check digit, other lengths and anything not digits", () => {
  for (const bad of [
    "4006381333932",
    "9638507",
    "123456789",
    "40063813339x1",
    "",
    null,
    undefined,
  ]) {
    assert.equal(normalizeBarcode(bad), null, `took ${JSON.stringify(bad)}`);
  }
});
