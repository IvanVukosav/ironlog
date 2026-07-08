import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import styles from "./Settings.module.css";

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
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Kcal cilj</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.kcalGoal || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, kcalGoal: event.target.value }))
          }
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Protein cilj (g)</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.proteinGoal || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, proteinGoal: event.target.value }))
          }
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Treninga tjedno</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.trainingsPerWeek || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, trainingsPerWeek: event.target.value }))
          }
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Carbs cilj (g)</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.carbsGoal || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, carbsGoal: event.target.value }))
          }
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Fat cilj (g)</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.fatGoal || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, fatGoal: event.target.value }))
          }
        />
      </div>

      <p className={styles.sectionLabel}>Dashboard widgeti</p>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showWorkoutWidget ?? true}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              showWorkoutWidget: event.target.checked,
            }))
          }
        />
        Prikaži trening widget
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showNutritionWidget ?? true}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              showNutritionWidget: event.target.checked,
            }))
          }
        />
        Prikaži prehrana widget
      </label>

      <button className={styles.saveButton} onClick={save}>
        Spremi
      </button>
    </div>
  );
}

export default Settings;
