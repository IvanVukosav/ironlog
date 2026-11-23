import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import { useReportError } from "./useReportError";
import { dayBeforeKey } from "../utils/dates";
import { nameKey } from "../utils/mealSuggestions";
import { toDecimalText } from "../utils/numbers";
import {
  withItemAdded,
  withItemChanged,
  withMealAdded,
  withMealLists,
  withoutItem,
  withoutMeal,
} from "../utils/nutritionState";

// The meal that Prehrana's old field for a food by name filled. Days logged with it still have
// one, shown in the page's language.
export const DEFAULT_MEAL_NAME = "Ostalo";
const NOTHING_TO_COPY = "Nothing to copy from that day";

const post = (path, json) => fetchJson(path, { method: "POST", json });
const remove = (path) => fetchJson(path, { method: "DELETE" });

// What the API gets for a food: the numbers as typed, a decimal comma read as a point. Grams
// left empty are 0, so a food can be logged by its kcal alone.
function toFoodValues({ name, kcal, protein, carbs, fat }) {
  const grams = (value) => toDecimalText(value) || "0";
  return {
    name: String(name).trim(),
    kcal: toDecimalText(kcal),
    protein: grams(protein),
    carbs: grams(carbs),
    fat: grams(fat),
  };
}

/**
 * The food log of one day (`date` is a "2026-11-04" key) and every change to it, the way
 * useWorkout keeps a workout. `day` is null while nothing is logged; the day itself is made
 * when the first meal or food goes in, so there is no separate step to start it.
 *
 * Each action saves, then shows the change, and resolves to what the server answered, or to
 * null once a failure has been reported.
 */
export function useNutritionDay(date) {
  const { t } = useTranslation();
  const { showError } = useToast();
  const reportError = useReportError();
  const [loaded, setLoaded] = useState({ date: null, day: null });
  // Meals being made by name ("<date>|<name>" → the promise of the saved meal), so two foods
  // tapped in quick succession into a meal not saved yet both go into one meal, not two. The
  // day being made is shared the same way ({ date, promise }).
  const mealsInMaking = useRef(new Map());
  const dayInMaking = useRef(null);
  const isLoading = loaded.date !== date;
  const day = isLoading ? null : loaded.day;

  useEffect(() => {
    // A slow answer for a day already left behind must not replace the day on screen.
    let isStale = false;
    fetchJson(`/api/nutrition?date=${date}`)
      .then((days) => {
        if (!isStale) setLoaded({ date, day: days[0] ? withMealLists(days[0]) : null });
      })
      .catch(reportError);
    return () => {
      isStale = true;
    };
  }, [date, reportError]);

  // A save that comes back after the date was switched finds another day loaded and is dropped.
  const show = (change) =>
    setLoaded((current) => (current.date === date ? { date, day: change(current.day) } : current));

  const fail = (err) => {
    reportError(err);
    return null;
  };

  const save = (request, change) =>
    request.then((answer) => {
      show((current) => (current ? change(current, answer) : current));
      return answer;
    }, fail);

  // The day as the server has it, made first if it isn't yet. A day shown meanwhile (a meal
  // made into it by another tap) is kept as it is.
  const ensureDay = () => {
    if (day) return Promise.resolve(day);
    if (dayInMaking.current?.date !== date) {
      const promise = post("/api/nutrition/days", { date }).then((created) => {
        show((current) => current ?? withMealLists(created));
        return created;
      });
      promise.catch(() => {
        if (dayInMaking.current?.promise === promise) dayInMaking.current = null;
      });
      dayInMaking.current = { date, promise };
    }
    return dayInMaking.current.promise;
  };

  const addMeal = async (name) => {
    try {
      const { id } = await ensureDay();
      return await save(post("/api/nutrition/meals", { name, nutritionDayId: id }), withMealAdded);
    } catch (err) {
      return fail(err);
    }
  };

  const addItem = (mealId, values) =>
    save(post(`/api/nutrition/meals/${mealId}/items`, toFoodValues(values)), withItemAdded);

  // The day's meal of that name: the one it has, or one made for it (null if that failed).
  const mealNamed = (name) => {
    const existing = day?.meals.find((meal) => nameKey(meal.name) === nameKey(name));
    if (existing) return Promise.resolve(existing);
    const key = `${date}|${nameKey(name)}`;
    if (!mealsInMaking.current.has(key)) {
      const making = addMeal(name).then((meal) => {
        if (!meal) mealsInMaking.current.delete(key);
        return meal;
      });
      mealsInMaking.current.set(key, making);
    }
    return mealsInMaking.current.get(key);
  };

  // A food into a meal card, which may be one offered but not saved yet (no id).
  const addItemToMeal = async (meal, values) => {
    const saved = meal.id ? meal : await mealNamed(meal.name);
    return saved ? addItem(saved.id, values) : null;
  };

  const deleteMeal = (mealId) => {
    const meal = day?.meals.find((entry) => entry.id === mealId);
    return save(remove(`/api/nutrition/meals/${mealId}`), (current) => {
      // A meal of this name made earlier is gone now: the next food makes a new one.
      if (meal) mealsInMaking.current.delete(`${date}|${nameKey(meal.name)}`);
      return withoutMeal(current, mealId);
    });
  };

  // Copies `fromDate`'s whole day into this one, or only its meal called `mealName`.
  const copyFrom = (fromDate, mealName) =>
    post("/api/nutrition/days/copy", { fromDate, toDate: date, mealName }).then(
      (copied) => {
        show(() => withMealLists(copied));
        return copied;
      },
      (err) => {
        if (err.message !== NOTHING_TO_COPY) return fail(err);
        showError(t("nutrition.nothingToCopy"));
        return null;
      },
    );

  return {
    day,
    isLoading,
    addMeal,
    addItem,
    addItemToMeal,
    deleteMeal,
    updateItem: (itemId, values) =>
      save(
        fetchJson(`/api/nutrition/items/${itemId}`, {
          method: "PATCH",
          json: toFoodValues(values),
        }),
        withItemChanged,
      ),
    deleteItem: (itemId) =>
      save(remove(`/api/nutrition/items/${itemId}`), (current) => withoutItem(current, itemId)),

    copyPreviousDay: () => copyFrom(dayBeforeKey(date)),

    // Last time's meal ({ name, date } from /api/nutrition/last-meals) eaten again today.
    copyMeal: (previous) => copyFrom(previous.date.slice(0, 10), previous.name),
  };
}
