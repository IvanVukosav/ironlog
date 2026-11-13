import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import DatePicker from "../components/DatePicker";
import Icon from "../components/Icon";
import MacroDonut from "../components/MacroDonut";
import MealCard from "../components/MealCard";
import TdeeCard from "../components/TdeeCard";
import { useSettings } from "../context/useSettings";
import { useNutritionDay } from "../hooks/useNutritionDay";
import { useReportError } from "../hooks/useReportError";
import { formatWeekdayDate, todayKey } from "../utils/dates";
import { formatNumber } from "../utils/numbers";
import { sumMacros } from "../utils/nutritionState";
import styles from "./Nutrition.module.css";

const RECENT_ITEMS_LIMIT = 8;
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
  const [searchParams] = useSearchParams();
  const [today] = useState(todayKey);
  const [date, setDate] = useState(searchParams.get("date") || today);
  const { day, isLoading, ...actions } = useNutritionDay(date);
  const { settings } = useSettings();
  const [mealName, setMealName] = useState("");
  const [foodItemTemplates, setFoodItemTemplates] = useState([]);
  const [recentItems, setRecentItems] = useState([]);
  const [quickAddName, setQuickAddName] = useState("");
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const quickAddRef = useRef(null);

  useEffect(() => {
    fetchJson("/api/food-item-templates").then(setFoodItemTemplates).catch(reportError);
    fetchJson(`/api/nutrition/recent-items?limit=${RECENT_ITEMS_LIMIT}`)
      .then(setRecentItems)
      .catch(reportError);
  }, [reportError]);

  useEffect(() => {
    if (!showQuickPicker) return undefined;
    const handleClickOutside = (event) => {
      if (quickAddRef.current && !quickAddRef.current.contains(event.target)) {
        setShowQuickPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showQuickPicker]);

  const addMeal = async () => {
    const name = mealName.trim();
    if (name && (await actions.addMeal(name))) setMealName("");
  };

  const quickAdd = async (food) => {
    if (await actions.quickAdd(food)) {
      setQuickAddName("");
      setShowQuickPicker(false);
    }
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

  const quickAddQuery = quickAddName.trim().toLowerCase();
  const filteredQuickTemplates = quickAddQuery
    ? foodItemTemplates.filter((template) => template.name.toLowerCase().includes(quickAddQuery))
    : foodItemTemplates;
  const filteredRecentItems = recentItems.filter((item) =>
    item.name.toLowerCase().includes(quickAddQuery),
  );

  const meals = day?.meals ?? [];
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

      {!isLoading && meals.length === 0 && (
        <p className={styles.empty}>{t("nutrition.noEntries")}</p>
      )}

      <div className={styles.addRow}>
        <div className={styles.quickAdd} ref={quickAddRef}>
          <input
            type="text"
            className={styles.searchInput}
            aria-label={t("nutrition.quickAddPlaceholder")}
            placeholder={t("nutrition.quickAddPlaceholder")}
            autoComplete="off"
            value={quickAddName}
            onChange={(event) => {
              setQuickAddName(event.target.value);
              setShowQuickPicker(true);
            }}
            onFocus={() => setShowQuickPicker(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setShowQuickPicker(false);
            }}
          />
          {showQuickPicker &&
            (filteredQuickTemplates.length > 0 || filteredRecentItems.length > 0) && (
              <div className={styles.picker}>
                {filteredRecentItems.length > 0 && (
                  <>
                    <div className={styles.pickerSection}>{t("nutrition.recentItems")}</div>
                    {filteredRecentItems.map((item) => (
                      <button
                        type="button"
                        key={`recent-${item.name}`}
                        className={styles.pickerOption}
                        onClick={() => quickAdd(item)}
                      >
                        {item.name}
                        <span className={styles.pickerKcal}>{`${kcal(item.kcal)} kcal`}</span>
                      </button>
                    ))}
                  </>
                )}
                {filteredQuickTemplates.length > 0 && filteredRecentItems.length > 0 && (
                  <div className={styles.pickerSection}>{t("nutrition.savedItems")}</div>
                )}
                {filteredQuickTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    className={styles.pickerOption}
                    onClick={() => quickAdd(template)}
                  >
                    {template.name}
                    <span className={styles.pickerKcal}>{`${kcal(template.kcal)} kcal`}</span>
                  </button>
                ))}
              </div>
            )}
        </div>
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

      {meals.length > 0 && (
        <div className={styles.mealList}>
          {meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              actions={actions}
              foodItemTemplates={foodItemTemplates}
              onSaveTemplate={saveFoodItemTemplate}
            />
          ))}
        </div>
      )}

      <TdeeCard today={today} />
    </div>
  );
}

export default Nutrition;
