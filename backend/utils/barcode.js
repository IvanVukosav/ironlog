// Barcodes on food packages (GTIN): EAN-8, UPC-A (12 digits), EAN-13 and GTIN-14, whose last
// digit checks the others. A UPC-A is kept as the EAN-13 it is with a 0 in front, the way Open
// Food Facts files it.
const GTIN_LENGTHS = [8, 12, 13, 14];

function hasValidCheckDigit(digits) {
  let sum = 0;
  // From the right, the digits before the check digit weigh 3, 1, 3, 1, …
  for (let index = digits.length - 2, weight = 3; index >= 0; index--, weight = 4 - weight) {
    sum += Number(digits[index]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

// The barcode as products are kept by, or null when the text is no valid barcode. Spaces and
// dashes typed between the digits are dropped.
function normalizeBarcode(text) {
  const digits = String(text ?? "").replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits) || !GTIN_LENGTHS.includes(digits.length)) return null;
  if (!hasValidCheckDigit(digits)) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}

module.exports = { normalizeBarcode };
