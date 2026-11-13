// Changes to a nutrition day as the Prehrana page holds it: { ...day, meals: [{ ...meal, items }] }.
// Each returns a new day and leaves the one it was given untouched.

function withItemList(meal) {
  return { ...meal, items: meal.items ?? [] };
}

// A day straight from the API, with an item list on every meal.
export function withMealLists(day) {
  return { ...day, meals: (day.meals ?? []).map(withItemList) };
}

export function withMealAdded(day, meal) {
  return { ...day, meals: [...day.meals, withItemList(meal)] };
}

export function withoutMeal(day, mealId) {
  return { ...day, meals: day.meals.filter((meal) => meal.id !== mealId) };
}

// An item knows its meal (`mealId`), so it finds its own place.
export function withItemAdded(day, item) {
  return {
    ...day,
    meals: day.meals.map((meal) =>
      meal.id === item.mealId ? { ...meal, items: [...meal.items, item] } : meal,
    ),
  };
}

export function withItemChanged(day, item) {
  return {
    ...day,
    meals: day.meals.map((meal) =>
      meal.id === item.mealId
        ? { ...meal, items: meal.items.map((other) => (other.id === item.id ? item : other)) }
        : meal,
    ),
  };
}

export function withoutItem(day, itemId) {
  return {
    ...day,
    meals: day.meals.map((meal) =>
      meal.items.some((item) => item.id === itemId)
        ? { ...meal, items: meal.items.filter((item) => item.id !== itemId) }
        : meal,
    ),
  };
}

// Kcal, protein, carbs and fat added up over some items.
export function sumMacros(items) {
  return items.reduce(
    (sum, item) => ({
      kcal: sum.kcal + item.kcal,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
