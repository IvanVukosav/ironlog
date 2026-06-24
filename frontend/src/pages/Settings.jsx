import { useState, useEffect } from "react";
import { fetchJson } from "../api";

function Settings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => console.error(err));
  }, []);

  const save = () => {
    const fields = [settings.kcalGoal, settings.proteinGoal, settings.trainingsPerWeek, settings.carbsGoal, settings.fatGoal];
    if (fields.some((field) => !field && field !== 0)) {
      alert("All fields must be filled in");
      return;
    }

    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        kcalGoal: parseInt(settings.kcalGoal),
        proteinGoal: parseInt(settings.proteinGoal),
        trainingsPerWeek: parseInt(settings.trainingsPerWeek),
        carbsGoal: parseInt(settings.carbsGoal),
        fatGoal: parseInt(settings.fatGoal),
      }),
    })
      .then(() => alert("Settings saved!"))
      .catch(() => alert("Error saving settings"));
  };

  return (
    <div className="page">
      <h1>Settings</h1>
      <label>Kcal cilj</label>
      <input
        type="number"
        value={settings?.kcalGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, kcalGoal: e.target.value }))
        }
      />
      <label>Protein cilj (g)</label>
      <input
        type="number"
        value={settings?.proteinGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, proteinGoal: e.target.value }))
        }
      />
      <label>Treninga tjedno</label>
      <input
        type="number"
        value={settings?.trainingsPerWeek || ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, trainingsPerWeek: e.target.value }))
        }
      />
      <label>Carbs cilj (g)</label>
      <input
        type="number"
        value={settings?.carbsGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, carbsGoal: e.target.value }))
        }
      />
      <label>Fat cilj (g)</label>
      <input
        type="number"
        value={settings?.fatGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, fatGoal: e.target.value }))
        }
      />

      <h2>Dashboard widgeti</h2>
      <label>
        <input
          type="checkbox"
          checked={settings?.showWorkoutWidget ?? true}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              showWorkoutWidget: e.target.checked,
            }))
          }
        />
        Prikaži trening widget
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings?.showNutritionWidget ?? true}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              showNutritionWidget: e.target.checked,
            }))
          }
        />
        Prikaži prehrana widget
      </label>

      <button onClick={save}>Spremi</button>
    </div>
  );
}

export default Settings;
