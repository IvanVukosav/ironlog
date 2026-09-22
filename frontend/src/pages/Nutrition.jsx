import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell } from "recharts";
import { fetchJson } from "../api";
import MealCard from "../components/MealCard";
import { useToast } from "../context/useToast";
import { getCssVar } from "../utils/theme";
import styles from "./Nutrition.module.css";

const KCAL_PER_GRAM_PROTEIN = 4;
const KCAL_PER_GRAM_CARBS = 4;
const KCAL_PER_GRAM_FAT = 9;
const MACRO_CHART_SIZE = 140;
const MACRO_CHART_INNER_RADIUS = 40;
const MACRO_CHART_OUTER_RADIUS = 65;
const PERCENT_MULTIPLIER = 100;

const DEFAULT_MEAL_NAME = "Ostalo";
const HISTORY_DAYS = { week: 7, month: 30 };

function formatChartDate(dateString) {
  const date = new Date(dateString);
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
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
      <div className={`${styles.totalsBarFill} ${colorClass}`} style={{ width: `${normalPercent}%` }} />
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
  const chartAccentColor = getCssVar("--color-accent");
  const chartTextDimColor = getCssVar("--color-text-dim");
  const chartBgCardColor = getCssVar("--color-bg-card");
  const chartBorderColor = getCssVar("--color-border");
  const chartTextColor = getCssVar("--color-text");
  const chartProteinColor = getCssVar("--color-protein");
  const chartCarbsColor = getCssVar("--color-carbs");
  const chartFatColor = getCssVar("--color-fat");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [day, setDay] = useState(null);
  const [mealName, setMealName] = useState("");
  const [foodItemTemplates, setFoodItemTemplates] = useState([]);
  const [settings, setSettings] = useState(null);
  const [quickAddName, setQuickAddName] = useState("");
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [historyRange, setHistoryRange] = useState("week");
  const [history, setHistory] = useState([]);
  const quickAddRef = useRef(null);

  useEffect(() => {
    fetchJson(`/api/nutrition?date=${date}`)
      .then((data) => setDay(data[0] || null))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [date, showError]);

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
    fetchJson(`/api/nutrition/history?days=${HISTORY_DAYS[historyRange]}`)
      .then((data) => setHistory(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [historyRange, day, showError]);

  useEffect(() => {
    fetchJson("/api/food-item-templates")
      .then((data) => setFoodItemTemplates(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [showError]);

  const createDay = () => {
    fetchJson("/api/nutrition/days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((data) => setDay(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const addMeal = () => {
    fetchJson("/api/nutrition/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mealName, nutritionDayId: day.id }),
    })
      .then((data) => {
        setDay((prev) => ({ ...prev, meals: [...(prev.meals || []), data] }));
        setMealName("");
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const quickAddItem = (template) => {
    const addItemToMeal = (mealId) =>
      fetchJson(`/api/nutrition/meals/${mealId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          kcal: template.kcal,
          protein: template.protein,
          carbs: template.carbs,
          fat: template.fat,
        }),
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: DEFAULT_MEAL_NAME, nutritionDayId: day.id }),
        }).then((newMeal) => {
          setDay((prev) => ({ ...prev, meals: [...(prev.meals || []), { ...newMeal, items: [] }] }));
          return addItemToMeal(newMeal.id).then((item) => applyItemToState(newMeal.id, item));
        });

    run
      .then(() => {
        setQuickAddName("");
        setShowQuickPicker(false);
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const saveFoodItemTemplate = (item) => {
    fetchJson("/api/food-item-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    })
      .then((data) => {
        setFoodItemTemplates((prev) =>
          [...prev, data].sort((templateA, templateB) => templateA.name.localeCompare(templateB.name)),
        );
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const filteredQuickTemplates = quickAddName.trim()
    ? foodItemTemplates.filter((template) =>
        template.name.toLowerCase().includes(quickAddName.trim().toLowerCase()),
      )
    : foodItemTemplates;

  const chartData = history.map((entry) => ({
    label: formatChartDate(entry.date),
    kcal: Math.round(entry.kcal),
  }));

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

  const macroKcal = {
    protein: totals.protein * KCAL_PER_GRAM_PROTEIN,
    carbs: totals.carbs * KCAL_PER_GRAM_CARBS,
    fat: totals.fat * KCAL_PER_GRAM_FAT,
  };
  const macroKcalTotal = macroKcal.protein + macroKcal.carbs + macroKcal.fat;
  const macroChartData = [
    { name: "Protein", value: macroKcal.protein, color: chartProteinColor },
    { name: "Carbs", value: macroKcal.carbs, color: chartCarbsColor },
    { name: "Fat", value: macroKcal.fat, color: chartFatColor },
  ].filter((entry) => entry.value > 0);
  const macroPercent = (kcal) =>
    macroKcalTotal > 0 ? Math.round((kcal / macroKcalTotal) * PERCENT_MULTIPLIER) : 0;

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

      {!day && (
        <button className={styles.startButton} onClick={createDay}>
          {t("nutrition.addDay")}
        </button>
      )}

      {day && (
        <div>
          <div className={styles.totalsCard}>
            <div className={styles.totalsGrid}>
              <div className={styles.totalsStat}>
                <span className={styles.totalsLabel}>Kcal</span>
                <span className={`${styles.totalsValue} ${styles.totalsValueKcal}`}>{totals.kcal} / {settings?.kcalGoal ?? "—"}</span>
                <GoalBar value={totals.kcal} goal={settings?.kcalGoal} colorClass={styles.totalsBarFillKcal} />
              </div>
              <div className={styles.totalsStat}>
                <span className={styles.totalsLabel}>Protein</span>
                <span className={`${styles.totalsValue} ${styles.totalsValueProtein}`}>{totals.protein}g / {settings?.proteinGoal ?? "—"}g</span>
                <GoalBar value={totals.protein} goal={settings?.proteinGoal} colorClass={styles.totalsBarFillProtein} />
              </div>
              <div className={styles.totalsStat}>
                <span className={styles.totalsLabel}>Carbs</span>
                <span className={`${styles.totalsValue} ${styles.totalsValueCarbs}`}>{totals.carbs}g / {settings?.carbsGoal ?? "—"}g</span>
                <GoalBar value={totals.carbs} goal={settings?.carbsGoal} colorClass={styles.totalsBarFillCarbs} />
              </div>
              <div className={styles.totalsStat}>
                <span className={styles.totalsLabel}>Fat</span>
                <span className={`${styles.totalsValue} ${styles.totalsValueFat}`}>{totals.fat}g / {settings?.fatGoal ?? "—"}g</span>
                <GoalBar value={totals.fat} goal={settings?.fatGoal} colorClass={styles.totalsBarFillFat} />
              </div>
            </div>
          </div>

          <div className={styles.historyCard}>
            <div className={styles.historyHeader}>
              <h2 className={styles.historyHeading}>{t("nutrition.kcalHistory")}</h2>
              <div className={styles.rangeTabs}>
                {[
                  { label: t("common.week"), range: "week" },
                  { label: t("common.month"), range: "month" },
                ].map(({ label, range }) => (
                  <button
                    key={range}
                    className={historyRange === range ? styles.rangeTabActive : styles.rangeTab}
                    onClick={() => setHistoryRange(range)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <XAxis dataKey="label" tick={{ fill: chartTextDimColor, fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chartTextDimColor, fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: chartBgCardColor, border: `1px solid ${chartBorderColor}`, fontFamily: "ui-monospace", fontSize: 12 }}
                    labelStyle={{ color: chartTextDimColor }}
                    itemStyle={{ color: chartTextColor }}
                    formatter={(value) => [`${value} kcal`, "Kcal"]}
                  />
                  {settings?.kcalGoal && (
                    <ReferenceLine y={settings.kcalGoal} stroke={chartTextDimColor} strokeDasharray="4 4" />
                  )}
                  <Bar dataKey="kcal" fill={chartAccentColor} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className={styles.emptyState}>{t("dashboard.noData")}</p>
            )}
          </div>

          <div className={styles.historyCard}>
            <div className={styles.historyHeader}>
              <h2 className={styles.historyHeading}>{t("nutrition.macroBreakdown")}</h2>
            </div>
            {macroChartData.length > 0 ? (
              <div className={styles.macroChartRow}>
                <PieChart width={MACRO_CHART_SIZE} height={MACRO_CHART_SIZE}>
                  <Pie
                    data={macroChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={MACRO_CHART_INNER_RADIUS}
                    outerRadius={MACRO_CHART_OUTER_RADIUS}
                    paddingAngle={2}
                  >
                    {macroChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: chartBgCardColor, border: `1px solid ${chartBorderColor}`, fontFamily: "ui-monospace", fontSize: 12 }}
                    labelStyle={{ color: chartTextDimColor }}
                    itemStyle={{ color: chartTextColor }}
                    formatter={(value, name) => [`${Math.round(value)} kcal`, name]}
                  />
                </PieChart>
                <div className={styles.macroLegend}>
                  <div className={styles.macroLegendRow}>
                    <span className={styles.macroLegendDot} style={{ backgroundColor: chartProteinColor }} />
                    Protein — {totals.protein}g ({macroPercent(macroKcal.protein)}%)
                  </div>
                  <div className={styles.macroLegendRow}>
                    <span className={styles.macroLegendDot} style={{ backgroundColor: chartCarbsColor }} />
                    Carbs — {totals.carbs}g ({macroPercent(macroKcal.carbs)}%)
                  </div>
                  <div className={styles.macroLegendRow}>
                    <span className={styles.macroLegendDot} style={{ backgroundColor: chartFatColor }} />
                    Fat — {totals.fat}g ({macroPercent(macroKcal.fat)}%)
                  </div>
                </div>
              </div>
            ) : (
              <p className={styles.emptyState}>{t("dashboard.noData")}</p>
            )}
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
            {showQuickPicker && filteredQuickTemplates.length > 0 && (
              <div className={styles.quickAddPicker}>
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
                            items: currentMeal.items.filter((currentItem) => currentItem.id !== itemId),
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
