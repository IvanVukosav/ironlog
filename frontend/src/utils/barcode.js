// Barcodes on food packages, as the camera reads them or as they are typed: EAN-13, EAN-8,
// UPC-A, UPC-E and GTIN-14, whose last digit checks the others. The backend checks them the same
// way (backend/utils/barcode.js) and keeps products by the result.
const GTIN_LENGTHS = [8, 12, 13, 14];

function hasValidCheckDigit(digits) {
  let sum = 0;
  // From the right, the digits before the check digit weigh 3, 1, 3, 1, …
  for (let index = digits.length - 2, weight = 3; index >= 0; index--, weight = 4 - weight) {
    sum += Number(digits[index]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

// A UPC-E (eight digits, the short code on small American packages) written out as the UPC-A
// it stands for, or null when it isn't one.
export function expandUpcE(code) {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [system, d1, d2, d3, d4, d5, d6, check] = code;
  let middle;
  if ("012".includes(d6)) middle = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") middle = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") middle = `${d1}${d2}${d3}${d4}00000${d5}`;
  else middle = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${system}${middle}${check}`;
}

/**
 * The barcode as products are kept by, or null when the text is no barcode. Spaces and dashes
 * typed between the digits are dropped, and a UPC-A gets the 0 that makes it an EAN-13. A UPC-E
 * is written out first: when the camera says so (`format` "upc_e"), or when eight typed digits
 * don't check out as an EAN-8.
 */
export function normalizeBarcode(text, format) {
  const digits = String(text ?? "").replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (format === "upc_e" || (digits.length === 8 && !hasValidCheckDigit(digits))) {
    const upcA = expandUpcE(digits);
    return upcA && hasValidCheckDigit(upcA) ? `0${upcA}` : null;
  }
  if (!GTIN_LENGTHS.includes(digits.length) || !hasValidCheckDigit(digits)) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}
