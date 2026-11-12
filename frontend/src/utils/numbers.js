// A number as someone typed it. Croatian keyboards and phone keypads give a decimal comma, which
// parseFloat stops at ("102,5" would be 102), so the comma counts as a point here.

// "102,5" → "102.5": the text as the API (and parseFloat) reads it. Anything else is left as it
// is, so what the server refuses is still what was typed.
export function toDecimalText(text) {
  return String(text ?? "")
    .trim()
    .replace(",", ".");
}

// The number in the text, or NaN.
export function parseDecimal(text) {
  return parseFloat(toDecimalText(text));
}
