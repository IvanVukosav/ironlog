// A scanned product eaten in some amount. Products hold their values per 100 g (or 100 ml,
// `unit`), as Open Food Facts and the package give them.
import { formatNumber } from "./numbers";

const PER = 100;
// The amounts offered with one tap besides a serving and the whole package.
const AMOUNTS = [50, 100, 200];

// What `amount` grams (or ml) of a product hold: kcal whole, grams to a tenth.
export function portionOf(product, amount) {
  const share = amount / PER;
  const tenth = (value) => Math.round(value * share * 10) / 10;
  return {
    kcal: Math.round(product.kcal * share),
    protein: tenth(product.protein),
    carbs: tenth(product.carbs),
    fat: tenth(product.fat),
  };
}

// The name the eaten food is logged by: the product and its amount, "Grčki jogurt 2 % 150 g".
export function portionName(product, amount, language) {
  return `${product.name} ${formatNumber(amount, language, { maxDecimals: 1 })} ${product.unit}`;
}

/**
 * The amounts to pick with one tap, smallest first: 50, 100 and 200, and a serving and the
 * whole package when the product says what those are (`kind` "serving" and "package"). Each
 * amount comes once; a serving or package as big as a plain amount takes its place.
 */
export function amountChoices(product) {
  const choices = new Map(AMOUNTS.map((amount) => [amount, { amount, kind: "amount" }]));
  if (product.servingSize) {
    choices.set(product.servingSize, { amount: product.servingSize, kind: "serving" });
  }
  if (product.packageSize) {
    choices.set(product.packageSize, { amount: product.packageSize, kind: "package" });
  }
  return [...choices.values()].sort((choiceA, choiceB) => choiceA.amount - choiceB.amount);
}

// The amount a product starts at: a serving when it has one, else 100.
export function startingAmount(product) {
  return product.servingSize ?? PER;
}
