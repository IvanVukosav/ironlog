import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import { useReportError } from "./useReportError";
import { toDecimalText } from "../utils/numbers";
import {
  withItemAdded,
  withItemChanged,
  withMealAdded,
  withMealLists,
  withoutItem,
  withoutMeal,
} from "../utils/nutritionState";

// Where a food added by name alone goes.
export const DEFAULT_MEAL_NAME = "Ostalo";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOTHING_TO_COPY = "Nothing to copy from that day";

const post = (path, json) => fetchJson(path, { method: "POST", json });
const remove = (path) => fetchJson(path, { method: "DELETE" });

function previousDateKey(dateKey) {
  return new Date(Date.parse(dateKey) - MS_PER_DAY).toISOString().split("T")[0];
}

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

  // The day as the server has it, made first if it isn't yet.
  const ensureDay = async () => {
    if (day) return day;
    const created = await post("/api/nutrition/days", { date });
    show(() => withMealLists(created));
    return created;
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

  return {
    day,
    isLoading,
    addMeal,
    addItem,
    deleteMeal: (mealId) =>
      save(remove(`/api/nutrition/meals/${mealId}`), (current) => withoutMeal(current, mealId)),
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

    // A food picked by name goes into the "Ostalo" meal, which is made when it isn't there.
    quickAdd: async (food) => {
      const existing = day?.meals.find((meal) => meal.name === DEFAULT_MEAL_NAME);
      const meal = existing ?? (await addMeal(DEFAULT_MEAL_NAME));
      return meal ? addItem(meal.id, food) : null;
    },

    copyPreviousDay: () =>
      post("/api/nutrition/days/copy", { fromDate: previousDateKey(date), toDate: date }).then(
        (copied) => {
          show(() => withMealLists(copied));
          return copied;
        },
        (err) => {
          if (err.message !== NOTHING_TO_COPY) return fail(err);
          showError(t("nutrition.nothingToCopy"));
          return null;
        },
      ),
  };
}
