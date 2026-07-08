import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import styles from "./Nutrition.module.css";

function Nutrition() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [day, setDay] = useState(null);
  const [mealName, setMealName] = useState("");
  const [foodItem, setFoodItem] = useState({
    name: "",
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  useEffect(() => {
    fetchJson(`/api/nutrition?date=${date}`)
      .then((data) => setDay(data[0] || null))
      .catch((err) => console.error(err));
  }, [date]);

  const createDay = () => {
    fetchJson("/api/nutrition/days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((data) => setDay(data))
      .catch((err) => console.error(err));
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
      .catch((err) => console.error(err));
  };

  const addFoodItem = (mealId) => {
    fetchJson(`/api/nutrition/meals/${mealId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(foodItem),
    })
      .then((data) => {
        setDay((prev) => ({
          ...prev,
          meals: prev.meals.map((meal) =>
            meal.id === mealId
              ? { ...meal, items: [...(meal.items || []), data] }
              : meal,
          ),
        }));
        setFoodItem({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
      })
      .catch((err) => console.error(err));
  };

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
              <div key={meal.id} className={styles.mealCard}>
                <h3 className={styles.mealHeading}>{meal.name}</h3>
                <div className={styles.itemInputRow}>
                  <input
                    type="text"
                    className={styles.itemInput}
                    placeholder="Naziv hrane"
                    value={foodItem.name}
                    onChange={(event) =>
                      setFoodItem((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    className={styles.itemInput}
                    placeholder="kcal"
                    value={foodItem.kcal}
                    onChange={(event) =>
                      setFoodItem((prev) => ({
                        ...prev,
                        kcal: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    className={styles.itemInput}
                    placeholder="protein"
                    value={foodItem.protein}
                    onChange={(event) =>
                      setFoodItem((prev) => ({
                        ...prev,
                        protein: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    className={styles.itemInput}
                    placeholder="carbs"
                    value={foodItem.carbs}
                    onChange={(event) =>
                      setFoodItem((prev) => ({
                        ...prev,
                        carbs: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    className={styles.itemInput}
                    placeholder="fat"
                    value={foodItem.fat}
                    onChange={(event) =>
                      setFoodItem((prev) => ({
                        ...prev,
                        fat: event.target.value,
                      }))
                    }
                  />
                  <button
                    className={styles.addItemButton}
                    onClick={() => addFoodItem(meal.id)}
                  >
                    Dodaj
                  </button>
                </div>
                <div className={styles.itemList}>
                  {meal.items?.map((item) => (
                    <div key={item.id} className={styles.itemRow}>
                      {item.name} — {item.kcal} kcal
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Nutrition;
