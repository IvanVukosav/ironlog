import { useState, useEffect } from "react";

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
    fetch(`http://localhost:3001/api/nutrition?date=${date}`)
      .then((res) => res.json())
      .then((data) => setDay(data[0] || null));
  }, [date]);

  const createDay = () => {
    fetch("http://localhost:3001/api/nutrition/days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((res) => res.json())
      .then((data) => setDay(data));
  };

  const addMeal = () => {
    fetch("http://localhost:3001/api/nutrition/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mealName, nutritionDayId: day.id }),
    })
      .then((res) => res.json())
      .then((data) => {
        setDay((prev) => ({ ...prev, meals: [...(prev.meals || []), data] }));
        setMealName("");
      });
  };

  const addFoodItem = (mealId) => {
    fetch(`http://localhost:3001/api/nutrition/meals/${mealId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(foodItem),
    })
      .then((res) => res.json())
      .then((data) => {
        setDay((prev) => ({
          ...prev,
          meals: prev.meals.map((m) =>
            m.id === mealId ? { ...m, items: [...(m.items || []), data] } : m,
          ),
        }));

        setFoodItem({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
      });
  };

  return (
    <div className="page">
      <h1>Nutrition</h1>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {!day && <button onClick={createDay}>Dodaj dan</button>}

      {day && (
        <div>
          <input
            type="text"
            placeholder="Ime obroka"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
          />
          <button onClick={addMeal}>Dodaj obrok</button>

          {day.meals?.map((meal) => (
            <div key={meal.id}>
              <h3>{meal.name}</h3>
              <input
                type="text"
                placeholder="Naziv hrane"
                value={foodItem.name}
                onChange={(e) =>
                  setFoodItem((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="kcal"
                value={foodItem.kcal}
                onChange={(e) =>
                  setFoodItem((prev) => ({ ...prev, kcal: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="protein"
                value={foodItem.protein}
                onChange={(e) =>
                  setFoodItem((prev) => ({ ...prev, protein: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="carbs"
                value={foodItem.carbs}
                onChange={(e) =>
                  setFoodItem((prev) => ({ ...prev, carbs: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="fat"
                value={foodItem.fat}
                onChange={(e) =>
                  setFoodItem((prev) => ({ ...prev, fat: e.target.value }))
                }
              />
              <button onClick={() => addFoodItem(meal.id)}>Dodaj</button>

              {meal.items?.map((item) => (
                <p key={item.id}>
                  {item.name} — {item.kcal} kcal
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Nutrition;
