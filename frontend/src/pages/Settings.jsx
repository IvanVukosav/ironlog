import { useState, useEffect } from "react";

function Settings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetch("http://localhost:3001/api/settings").then((response) =>
      response.json().then((data) => setSettings(data)),
    );
  }, []);

  const save = () => {
    fetch("http://localhost:3001/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  };

  return (
    <div className="page">
      <h1>Settings</h1>
      <label>Kcal cilj</label>
      <input
        type="number"
        value={settings?.kcalGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({
            ...prev,
            kcalGoal: parseInt(e.target.value),
          }))
        }
      />
      <label>Protein cilj (g)</label>
      <input
        type="number"
        value={settings?.proteinGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({
            ...prev,
            proteinGoal: parseInt(e.target.value),
          }))
        }
      />
      <label>Treninga tjedno</label>
      <input
        type="number"
        value={settings?.trainingsPerWeek || ""}
        onChange={(e) =>
          setSettings((prev) => ({
            ...prev,
            trainingsPerWeek: parseInt(e.target.value),
          }))
        }
      />
      <label>Carbs cilj (g)</label>
      <input
        type="number"
        value={settings?.carbsGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({
            ...prev,
            carbsGoal: parseInt(e.target.value),
          }))
        }
      />
      <label>Fat cilj (g)</label>
      <input
        type="number"
        value={settings?.fatGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({
            ...prev,
            fatGoal: parseInt(e.target.value),
          }))
        }
      />
      <button onClick={save}>Spremi</button>
    </div>
  );
}

export default Settings;
