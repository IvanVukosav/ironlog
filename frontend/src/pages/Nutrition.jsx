import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import DatePicker from "../components/DatePicker";
import Icon from "../components/Icon";
import MacroDonut from "../components/MacroDonut";
import MealCard from "../components/MealCard";
import TdeeCard from "../components/TdeeCard";
import { useSettings } from "../context/useSettings";
import { useDateParam } from "../hooks/useDateParam";
import { useNutritionDay } from "../hooks/useNutritionDay";
import { useReportError } from "../hooks/useReportError";
import { formatWeekdayDate, todayKey } from "../utils/dates";
import {
  firstEmptyCardKey,
  mealCards,
  previousMeal,
  recentFoodsFor,
  searchableFoods,
} from "../utils/mealSuggestions";
import { formatNumber } from "../utils/numbers";
import { sumMacros } from "../utils/nutritionState";
import styles from "./Nutrition.module.css";

// One-tap foods in a meal, and how many foods its name field searches besides the favourites.
const MEAL_CHIPS_LIMIT = 6;
const MEAL_SEARCH_LIMIT = 30;
const NOTHING_ELSE = [];
const MAX_PERCENT = 100;
const MACROS = [
  { key: "protein", labelKey: "nutrition.macroProtein", goalKey: "proteinGoal" },
  { key: "carbs", labelKey: "nutrition.macroCarbs", goalKey: "carbsGoal" },
  { key: "fat", labelKey: "nutrition.macroFat", goalKey: "fatGoal" },
];

// How much of the bar a value fills against its goal. Past the goal, the bar is the whole
// value: the goal's share in the colour, the rest striped.
function getBarSegments(value, goal) {
  if (!goal) return { normalPercent: 0, overPercent: 0 };
  if (value <= goal) {
    return { normalPercent: Math.min(MAX_PERCENT, (value / goal) * MAX_PERCENT), overPercent: 0 };
  }
  const normalPercent = (goal / value) * MAX_PERCENT;
  return { normalPercent, overPercent: MAX_PERCENT - normalPercent };
}

function GoalBar({ value, goal, color }) {
  const { normalPercent, overPercent } = getBarSegments(value, goal);
  return (
    <div className={styles.barTrack}>
      <div className={styles.barFill} style={{ width: `${normalPercent}%`, background: color }} />
      {overPercent > 0 && (
        <div
          className={`${styles.barFill} ${styles.barFillOver}`}
          style={{ width: `${overPercent}%`, background: color }}
        />
      )}
    </div>
  );
}

function Nutrition() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const reportError = useReportError();
  const [today] = useState(todayKey);
  const [date, setDate] = useDateParam();
  const { day, isLoading, ...actions } = useNutritionDay(date);
  const { settings } = useSettings();
  const [mealName, setMealName] = useState("");
  const [foodItemTemplates, setFoodItemTemplates] = useState([]);
  const [recentItems, setRecentItems] = useState([]);
  const [recentByMeal, setRecentByMeal] = useState([]);
  // The meals of the days before `date`, kept with the date they were asked for.
  const [lastMeals, setLastMeals] = useState({ date: null, meals: [] });
  // The card open for adding food, for one date: none chosen follows the first empty meal, and
  // anything done in a card keeps that one open, so it doesn't jump on once the meal has food.
  const [openCard, setOpenCard] = useState({ date: null, key: null });

  useEffect(() => {
    fetchJson("/api/food-item-templates").then(setFoodItemTemplates).catch(reportError);
    fetchJson(`/api/nutrition/recent-items?limit=${MEAL_SEARCH_LIMIT}`)
      .then(setRecentItems)
      .catch(reportError);
    fetchJson(`/api/nutrition/recent-by-meal?limit=${MEAL_SEARCH_LIMIT}`)
      .then(setRecentByMeal)
      .catch(reportError);
  }, [reportError]);

  useEffect(() => {
    let isStale = false;
    fetchJson(`/api/nutrition/last-meals?before=${date}`)
      .then((meals) => {
        if (!isStale) setLastMeals({ date, meals });
      })
      .catch(reportError);
    return () => {
      isStale = true;
    };
  }, [date, reportError]);

  const addMeal = async () => {
    const name = mealName.trim();
    if (name && (await actions.addMeal(name))) setMealName("");
  };

  const saveFoodItemTemplate = (food) => {
    fetchJson("/api/food-item-templates", { method: "POST", json: food })
      .then((saved) =>
        setFoodItemTemplates((prev) =>
          [...prev, saved].sort((templateA, templateB) =>
            templateA.name.localeCompare(templateB.name),
          ),
        ),
      )
      .catch(reportError);
  };

  const deleteFoodItemTemplate = (template) => {
    fetchJson(`/api/food-item-templates/${template.id}`, { method: "DELETE" })
      .then(() => setFoodItemTemplates((prev) => prev.filter((other) => other.id !== template.id)))
      .catch(reportError);
  };

  const meals = day?.meals ?? [];
  // Until the earlier days of this date have come, only the day's own meals are shown.
  const earlierMeals = lastMeals.date === date ? lastMeals.meals : NOTHING_ELSE;
  const cards = isLoading ? [] : mealCards(meals, earlierMeals);
  const openKey = (openCard.date === date ? openCard.key : null) ?? firstEmptyCardKey(cards);
  const eaten = { recentByMeal, recentAll: recentItems, favourites: foodItemTemplates };
  const totals = sumMacros(meals.flatMap((meal) => meal.items));
  const kcalGoal = settings?.kcalGoal;
  const kcal = (value) => formatNumber(value, language, { maxDecimals: 0 });
  const grams = (value) => formatNumber(value, language, { maxDecimals: 1 });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <DatePicker value={date} onChange={setDate} variant="text">
          {formatWeekdayDate(date, language)}
          <Icon name="chevronDown" size={16} />
        </DatePicker>
        <h1 className={styles.heading}>{t("nav.nutrition")}</h1>
      </header>

      <section className={styles.summary}>
        <div className={styles.summaryMain}>
          <h2 className={styles.cardTitle}>{t("nutrition.dayTotal")}</h2>
          <p className={styles.bigNumber}>
            {kcal(totals.kcal)}
            <span className={styles.bigUnit}>
              {kcalGoal ? ` / ${kcal(kcalGoal)} kcal` : " kcal"}
            </span>
          </p>
          <GoalBar value={totals.kcal} goal={kcalGoal} color="var(--color-accent)" />
          <div className={styles.macroGrid}>
            {MACROS.map(({ key, labelKey, goalKey }) => {
              const goal = settings?.[goalKey];
              return (
                <div key={key} className={styles.macro}>
                  <span className={styles.macroLabel}>
                    <span
                      className={styles.macroDot}
                      style={{ background: `var(--color-${key})` }}
                    />
                    {t(labelKey)}
                  </span>
                  <span className={styles.macroValue}>
                    {goal ? `${grams(totals[key])} / ${grams(goal)} g` : `${grams(totals[key])} g`}
                  </span>
                  <GoalBar value={totals[key]} goal={goal} color={`var(--color-${key})`} />
                </div>
              );
            })}
          </div>
        </div>
        <MacroDonut
          className={styles.donut}
          protein={totals.protein}
          carbs={totals.carbs}
          fat={totals.fat}
        />
      </section>

      {!isLoading && cards.length === 0 && (
        <p className={styles.empty}>{t("nutrition.noEntries")}</p>
      )}

      <div className={styles.addRow}>
        <form
          className={styles.addMeal}
          onSubmit={(event) => {
            event.preventDefault();
            addMeal();
          }}
        >
          <input
            type="text"
            className={styles.mealInput}
            aria-label={t("nutrition.mealNamePlaceholder")}
            placeholder={t("nutrition.mealNamePlaceholder")}
            autoComplete="off"
            value={mealName}
            onChange={(event) => setMealName(event.target.value)}
          />
          <button type="submit" className={styles.addMealButton} disabled={!mealName.trim()}>
            {t("nutrition.addMeal")}
          </button>
        </form>
        <button type="button" className={styles.secondaryButton} onClick={actions.copyPreviousDay}>
          {t("nutrition.copyPreviousDay")}
        </button>
      </div>

      {cards.length > 0 && (
        <div className={styles.mealList}>
          {cards.map((meal) => (
            <MealCard
              key={meal.key}
              meal={meal}
              date={date}
              isOpen={meal.key === openKey}
              onOpen={() => setOpenCard({ date, key: meal.key })}
              actions={actions}
              favourites={foodItemTemplates}
              recentFoods={recentFoodsFor(meal, { ...eaten, limit: MEAL_CHIPS_LIMIT })}
              searchFoods={searchableFoods(meal, { ...eaten, limit: MEAL_SEARCH_LIMIT })}
              previous={meal.items.length === 0 ? previousMeal(meal, earlierMeals) : null}
              onSaveFavourite={saveFoodItemTemplate}
              onDeleteFavourite={deleteFoodItemTemplate}
            />
          ))}
        </div>
      )}

      <TdeeCard today={today} />
    </div>
  );
}

export default Nutrition;
