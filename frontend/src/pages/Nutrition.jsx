import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import MealCard from "../components/MealCard";
import { useToast } from "../context/useToast";
import styles from "./Nutrition.module.css";

function Nutrition() {
  const { showError } = useToast();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [day, setDay] = useState(null);
  const [mealName, setMealName] = useState("");
  const [foodItemTemplates, setFoodItemTemplates] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchJson(`/api/nutrition?date=${date}`)
      .then((data) => setDay(data[0] || null))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [date, showError]);

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
      <h1 className={styles.heading}>Nutrition</h1>

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
          Dodaj dan
        </button>
      )}

      {day && (
        <div>
          <div className={styles.totalsCard}>
            <div className={styles.totalsGrid}>
              <div className={styles.totalsStat}>
                <span className={styles.totalsLabel}>Kcal</span>
                <span className={`${styles.totalsValue} ${styles.totalsValueKcal}`}>{totals.kcal} / {settings?.kcalGoal ?? "—"}</span>
              </div>
              <div className={styles.totalsStat}>
                <span className={styles.totalsLabel}>Protein</span>
                <span className={`${styles.totalsValue} ${styles.totalsValueProtein}`}>{totals.protein}g / {settings?.proteinGoal ?? "—"}g</span>
              </div>
              <div className={styles.totalsStat}>
                <span className={styles.totalsLabel}>Carbs</span>
                <span className={`${styles.totalsValue} ${styles.totalsValueCarbs}`}>{totals.carbs}g / {settings?.carbsGoal ?? "—"}g</span>
              </div>
              <div className={styles.totalsStat}>
                <span className={styles.totalsLabel}>Fat</span>
                <span className={`${styles.totalsValue} ${styles.totalsValueFat}`}>{totals.fat}g / {settings?.fatGoal ?? "—"}g</span>
              </div>
            </div>
          </div>

          <div className={styles.addMealRow}>
            <input
              type="text"
              className={styles.mealInput}
              placeholder="Ime obroka"
              value={mealName}
              onChange={(event) => setMealName(event.target.value)}
            />
            <button className={styles.addMealButton} onClick={addMeal}>
              Dodaj obrok
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
