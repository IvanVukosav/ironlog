import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import MacroDonut from "../components/MacroDonut";
import MealCard from "../components/MealCard";
import TdeeCard from "../components/TdeeCard";
import { useToast } from "../context/useToast";
import { useSettings } from "../context/useSettings";
import { useReportError } from "../hooks/useReportError";
import { todayKey } from "../utils/dates";
import styles from "./Nutrition.module.css";

const DEFAULT_MEAL_NAME = "Ostalo";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RECENT_ITEMS_LIMIT = 8;

function previousDateString(dateString) {
  return new Date(new Date(dateString).getTime() - MS_PER_DAY).toISOString().split("T")[0];
}

function getBarSegments(value, goal) {
  if (!goal) return { normalPercent: 0, overPercent: 0 };
  if (value <= goal) {
    return { normalPercent: Math.min(100, Math.round((value / goal) * 100)), overPercent: 0 };
  }
  const normalPercent = Math.round((goal / value) * 100);
  return { normalPercent, overPercent: 100 - normalPercent };
}

function GoalBar({ value, goal, colorClass }) {
  const { normalPercent, overPercent } = getBarSegments(value, goal);
  return (
    <div className={styles.totalsBarTrack}>
      <div
        className={`${styles.totalsBarFill} ${colorClass}`}
        style={{ width: `${normalPercent}%` }}
      />
      {overPercent > 0 && (
        <div
          className={`${styles.totalsBarFill} ${colorClass} ${styles.totalsBarFillOverGoal}`}
          style={{ width: `${overPercent}%` }}
        />
      )}
    </div>
  );
}

function Nutrition() {
  const { t } = useTranslation();
  const { showError } = useToast();
  const reportError = useReportError();
  const [today] = useState(todayKey);
  const [date, setDate] = useState(today);
  const [day, setDay] = useState(null);
  const [mealName, setMealName] = useState("");
  const [foodItemTemplates, setFoodItemTemplates] = useState([]);
  const [recentItems, setRecentItems] = useState([]);
  const { settings } = useSettings();
  const [quickAddName, setQuickAddName] = useState("");
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const quickAddRef = useRef(null);

  useEffect(() => {
    fetchJson(`/api/nutrition?date=${date}`)
      .then((data) => setDay(data[0] || null))
      .catch(reportError);
  }, [date, reportError]);

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

  useEffect(() => {
    fetchJson("/api/food-item-templates").then(setFoodItemTemplates).catch(reportError);

    fetchJson(`/api/nutrition/recent-items?limit=${RECENT_ITEMS_LIMIT}`)
      .then(setRecentItems)
      .catch(reportError);
  }, [reportError]);

  const createDay = () => {
    fetchJson("/api/nutrition/days", {
      method: "POST",
      json: { date },
    })
      .then(setDay)
      .catch(reportError);
  };

  const copyPreviousDay = () => {
    fetchJson("/api/nutrition/days/copy", {
      method: "POST",
      json: { fromDate: previousDateString(date), toDate: date },
    })
      .then(setDay)
      .catch((err) => {
        console.error(err);
        showError(
          err.message === "Nothing to copy from that day"
            ? t("nutrition.nothingToCopy")
            : err.message,
        );
      });
  };

  const addMeal = () => {
    fetchJson("/api/nutrition/meals", {
      method: "POST",
      json: { name: mealName, nutritionDayId: day.id },
    })
      .then((data) => {
        setDay((prev) => ({ ...prev, meals: [...(prev.meals || []), data] }));
        setMealName("");
      })
      .catch(reportError);
  };

  const quickAddItem = (template) => {
    const addItemToMeal = (mealId) =>
      fetchJson(`/api/nutrition/meals/${mealId}/items`, {
        method: "POST",
        json: {
          name: template.name,
          kcal: template.kcal,
          protein: template.protein,
          carbs: template.carbs,
          fat: template.fat,
        },
      });

    const applyItemToState = (mealId, item) => {
      setDay((prev) => ({
        ...prev,
        meals: prev.meals.map((currentMeal) =>
          currentMeal.id === mealId
            ? { ...currentMeal, items: [...(currentMeal.items || []), item] }
            : currentMeal,
        ),
      }));
    };

    const existingMeal = day.meals?.find((meal) => meal.name === DEFAULT_MEAL_NAME);

    const run = existingMeal
      ? addItemToMeal(existingMeal.id).then((item) => applyItemToState(existingMeal.id, item))
      : fetchJson("/api/nutrition/meals", {
          method: "POST",
          json: { name: DEFAULT_MEAL_NAME, nutritionDayId: day.id },
        }).then((newMeal) => {
          setDay((prev) => ({
            ...prev,
            meals: [...(prev.meals || []), { ...newMeal, items: [] }],
          }));
          return addItemToMeal(newMeal.id).then((item) => applyItemToState(newMeal.id, item));
        });

    run
      .then(() => {
        setQuickAddName("");
        setShowQuickPicker(false);
      })
      .catch(reportError);
  };

  const saveFoodItemTemplate = (item) => {
    fetchJson("/api/food-item-templates", {
      method: "POST",
      json: item,
    })
      .then((data) => {
        setFoodItemTemplates((prev) =>
          [...prev, data].sort((templateA, templateB) =>
            templateA.name.localeCompare(templateB.name),
          ),
        );
      })
      .catch(reportError);
  };

  const quickAddQuery = quickAddName.trim().toLowerCase();
  const filteredQuickTemplates = quickAddQuery
    ? foodItemTemplates.filter((template) => template.name.toLowerCase().includes(quickAddQuery))
    : foodItemTemplates;
  const filteredRecentItems = recentItems.filter((item) =>
    item.name.toLowerCase().includes(quickAddQuery),
  );

  const allItems = day?.meals?.flatMap((meal) => meal.items || []) || [];
  const totals = allItems.reduce(
    (sum, item) => ({
      kcal: sum.kcal + item.kcal,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("nav.nutrition")}</h1>

      <div className={styles.topRow}>
        <input
          type="date"
          className={styles.dateInput}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <TdeeCard today={today} />

      {!day && (
        <div className={styles.startRow}>
          <button className={styles.startButton} onClick={createDay}>
            {t("nutrition.addDay")}
          </button>
          <button className={styles.copyDayButton} onClick={copyPreviousDay}>
            {t("nutrition.copyPreviousDay")}
          </button>
        </div>
      )}

      {day && (
        <div>
          <div className={styles.totalsCard}>
            <div className={styles.totalsRow}>
              <MacroDonut
                className={styles.macroChartBlock}
                protein={totals.protein}
                carbs={totals.carbs}
                fat={totals.fat}
              />

              <div className={styles.totalsGrid}>
                <div className={styles.totalsStat}>
                  <span className={styles.totalsLabel}>Kcal</span>
                  <span className={`${styles.totalsValue} ${styles.totalsValueKcal}`}>
                    {totals.kcal} / {settings?.kcalGoal ?? "—"}
                  </span>
                  <GoalBar
                    value={totals.kcal}
                    goal={settings?.kcalGoal}
                    colorClass={styles.totalsBarFillKcal}
                  />
                </div>
                <div className={styles.totalsStat}>
                  <span className={styles.totalsLabel}>{t("nutrition.macroProtein")}</span>
                  <span className={`${styles.totalsValue} ${styles.totalsValueProtein}`}>
                    {totals.protein}g / {settings?.proteinGoal ?? "—"}g
                  </span>
                  <GoalBar
                    value={totals.protein}
                    goal={settings?.proteinGoal}
                    colorClass={styles.totalsBarFillProtein}
                  />
                </div>
                <div className={styles.totalsStat}>
                  <span className={styles.totalsLabel}>{t("nutrition.macroCarbs")}</span>
                  <span className={`${styles.totalsValue} ${styles.totalsValueCarbs}`}>
                    {totals.carbs}g / {settings?.carbsGoal ?? "—"}g
                  </span>
                  <GoalBar
                    value={totals.carbs}
                    goal={settings?.carbsGoal}
                    colorClass={styles.totalsBarFillCarbs}
                  />
                </div>
                <div className={styles.totalsStat}>
                  <span className={styles.totalsLabel}>{t("nutrition.macroFat")}</span>
                  <span className={`${styles.totalsValue} ${styles.totalsValueFat}`}>
                    {totals.fat}g / {settings?.fatGoal ?? "—"}g
                  </span>
                  <GoalBar
                    value={totals.fat}
                    goal={settings?.fatGoal}
                    colorClass={styles.totalsBarFillFat}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.quickAddRow} style={{ position: "relative" }} ref={quickAddRef}>
            <input
              type="text"
              className={styles.mealInput}
              placeholder={t("nutrition.quickAddPlaceholder")}
              value={quickAddName}
              onChange={(event) => {
                setQuickAddName(event.target.value);
                setShowQuickPicker(true);
              }}
              onFocus={() => setShowQuickPicker(true)}
            />
            {showQuickPicker &&
              (filteredQuickTemplates.length > 0 || filteredRecentItems.length > 0) && (
                <div className={styles.quickAddPicker}>
                  {filteredRecentItems.length > 0 && (
                    <>
                      <div className={styles.quickAddSection}>{t("nutrition.recentItems")}</div>
                      {filteredRecentItems.map((item) => (
                        <button
                          key={`recent-${item.name}`}
                          className={styles.quickAddOption}
                          onClick={() => quickAddItem(item)}
                        >
                          {item.name}
                          <span className={styles.quickAddMacros}>{item.kcal} kcal</span>
                        </button>
                      ))}
                    </>
                  )}
                  {filteredQuickTemplates.length > 0 && filteredRecentItems.length > 0 && (
                    <div className={styles.quickAddSection}>{t("nutrition.savedItems")}</div>
                  )}
                  {filteredQuickTemplates.map((template) => (
                    <button
                      key={template.id}
                      className={styles.quickAddOption}
                      onClick={() => quickAddItem(template)}
                    >
                      {template.name}
                      <span className={styles.quickAddMacros}>{template.kcal} kcal</span>
                    </button>
                  ))}
                </div>
              )}
          </div>

          <div className={styles.addMealRow}>
            <input
              type="text"
              className={styles.mealInput}
              placeholder={t("nutrition.mealNamePlaceholder")}
              value={mealName}
              onChange={(event) => setMealName(event.target.value)}
            />
            <button className={styles.addMealButton} onClick={addMeal}>
              {t("nutrition.addMeal")}
            </button>
            <button className={styles.copyDayButton} onClick={copyPreviousDay}>
              {t("nutrition.copyPreviousDay")}
            </button>
          </div>

          <div className={styles.mealList}>
            {day.meals?.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                foodItemTemplates={foodItemTemplates}
                onSaveTemplate={saveFoodItemTemplate}
                onAddItem={(data) =>
                  setDay((prev) => ({
                    ...prev,
                    meals: prev.meals.map((currentMeal) =>
                      currentMeal.id === meal.id
                        ? { ...currentMeal, items: [...(currentMeal.items || []), data] }
                        : currentMeal,
                    ),
                  }))
                }
                onUpdateItem={(updatedItem) =>
                  setDay((prev) => ({
                    ...prev,
                    meals: prev.meals.map((currentMeal) =>
                      currentMeal.id === meal.id
                        ? {
                            ...currentMeal,
                            items: currentMeal.items.map((currentItem) =>
                              currentItem.id === updatedItem.id ? updatedItem : currentItem,
                            ),
                          }
                        : currentMeal,
                    ),
                  }))
                }
                onDeleteItem={(itemId) =>
                  setDay((prev) => ({
                    ...prev,
                    meals: prev.meals.map((currentMeal) =>
                      currentMeal.id === meal.id
                        ? {
                            ...currentMeal,
                            items: currentMeal.items.filter(
                              (currentItem) => currentItem.id !== itemId,
                            ),
                          }
                        : currentMeal,
                    ),
                  }))
                }
                onDeleteMeal={(mealId) =>
                  setDay((prev) => ({
                    ...prev,
                    meals: prev.meals.filter((currentMeal) => currentMeal.id !== mealId),
                  }))
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Nutrition;
