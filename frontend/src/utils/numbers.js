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

// A saved number put back in a field to be changed: "90,6" in Croatian, "90.6" in English, and
// never a thousands separator, so toDecimalText reads it back as the same number. Nothing saved
// gives an empty field.
export function toInputText(value, language) {
  if (value === null || value === undefined) return "";
  const decimalMark = new Intl.NumberFormat(language)
    .formatToParts(0.5)
    .find((part) => part.type === "decimal").value;
  return String(value).replace(".", decimalMark);
}

// A number written the way the language writes it: "180,0" in Croatian, "180.0" in English.
// `decimals` fixes the decimal places; without it, up to `maxDecimals` (2) show, none if whole.
export function formatNumber(value, language, { decimals, maxDecimals = 2 } = {}) {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? maxDecimals,
  }).format(value);
}

// A percentage the way the language writes it: "97,5 %" in Croatian, "97.5%" in English. `value`
// is the number of percent (97.5), not a fraction.
export function formatPercent(value, language) {
  return new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 1 }).format(
    value / 100,
  );
}

// A set as one line: "102,5 kg × 5 @ 8", without the "@" part when it has no RPE.
export function formatSet({ weight, reps, rpe }, language) {
  const base = `${formatNumber(weight, language)} kg × ${reps}`;
  return Number.isFinite(rpe) ? `${base} @ ${formatNumber(rpe, language)}` : base;
}

// Weight moved: tonnes from 1000 kg up ("48,2 t"), kilograms below ("850 kg").
export function formatVolume(kg, language) {
  return kg >= 1000
    ? `${formatNumber(kg / 1000, language, { decimals: 1 })} t`
    : `${formatNumber(kg, language, { decimals: 0 })} kg`;
}
