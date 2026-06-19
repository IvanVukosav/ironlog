import { useState, useEffect } from "react";

function Settings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetch("http://localhost:3001/api/settings").then((response) =>
      response.json().then((data) => setSettings(data)),
    );
  }, []);

  const save = () => {
    const fields = [settings.kcalGoal, settings.proteinGoal, settings.trainingsPerWeek, settings.carbsGoal, settings.fatGoal];
    if (fields.some((field) => !field && field !== 0)) {
      alert("All fields must be filled in");
      return;
    }

    fetch("http://localhost:3001/api/settings", {
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
      .then((res) => res.json())
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
      <button onClick={save}>Spremi</button>
    </div>
  );
}

export default Settings;
