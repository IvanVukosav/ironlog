// What Prehrana offers so a day is logged with fewer taps, worked out from the day itself and
// from what was eaten before it: meals to fill again, last time's meal to copy, and foods that
// go in with one tap.

// Names of foods and meals are told apart without case or the spaces around them.
export const nameKey = (name) => String(name).trim().toLowerCase();

/**
 * The day's meals, and after them the meals of the last day before it that this one lacks, as
 * empty cards to fill (`id` null: nothing is saved until food goes in). `lastMeals` is
 * /api/nutrition/last-meals, newest day first. Each card gets a `key` that stays the same when
 * an empty card's meal is saved, so the card keeps what is typed in it; a second meal of the
 * same name is told apart by its id.
 */
export function mealCards(meals, lastMeals) {
  const latestDate = lastMeals[0]?.date;
  const names = new Set();
  const cards = meals.map((meal) => {
    const key = nameKey(meal.name);
    const card = { ...meal, key: names.has(key) ? `id:${meal.id}` : `name:${key}` };
    names.add(key);
    return card;
  });
  for (const meal of lastMeals) {
    const key = nameKey(meal.name);
    if (meal.date !== latestDate || names.has(key)) continue;
    names.add(key);
    cards.push({ id: null, name: meal.name, items: [], key: `name:${key}` });
  }
  return cards;
}

// The last meal of the same name before this day ({ name, date, items }), or null.
export function previousMeal(meal, lastMeals) {
  return lastMeals.find((last) => nameKey(last.name) === nameKey(meal.name)) ?? null;
}

/**
 * Foods for one tap in a meal: what was eaten lately at this meal (`recentByMeal`, from
 * /api/nutrition/recent-by-meal), or, for a meal never had before, what was eaten lately at all
 * (`recentAll`). Foods the meal holds already, and the favourites, which have their own row,
 * are left out.
 */
export function recentFoodsFor(meal, { recentByMeal, recentAll, favourites, limit }) {
  const own = recentByMeal.find((entry) => nameKey(entry.meal) === nameKey(meal.name));
  const skip = new Set([...meal.items, ...favourites].map((food) => nameKey(food.name)));
  const foods = [];
  for (const food of own?.items.length ? own.items : recentAll) {
    const key = nameKey(food.name);
    if (skip.has(key)) continue;
    skip.add(key);
    foods.push(food);
    if (foods.length === limit) break;
  }
  return foods;
}

// What a meal's name field searches besides the favourites: this meal's foods first, then
// everything eaten lately, each once.
export function searchableFoods(meal, { recentByMeal, recentAll, favourites, limit }) {
  const own = recentByMeal.find((entry) => nameKey(entry.meal) === nameKey(meal.name));
  const skip = new Set(favourites.map((favourite) => nameKey(favourite.name)));
  const foods = [];
  for (const food of [...(own?.items ?? []), ...recentAll]) {
    const key = nameKey(food.name);
    if (skip.has(key)) continue;
    skip.add(key);
    foods.push(food);
    if (foods.length === limit) break;
  }
  return foods;
}

// The card whose ways of adding food are open when the page comes: the first meal still empty.
export function firstEmptyCardKey(cards) {
  return cards.find((card) => card.items.length === 0)?.key ?? null;
}

// Foods whose name holds what is typed (case aside), for the list under a food's name field.
export function foodsMatching(foods, query) {
  const wanted = nameKey(query);
  return wanted ? foods.filter((food) => nameKey(food.name).includes(wanted)) : [];
}
