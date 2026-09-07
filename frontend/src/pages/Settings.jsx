import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import { ONE_REP_MAX_FORMULAS } from "../utils/oneRepMax";
import styles from "./Settings.module.css";

const E1RM_FORMULA_LABELS = {
  [ONE_REP_MAX_FORMULAS.brzycki]: "Brzycki",
  [ONE_REP_MAX_FORMULAS.epley]: "Epley",
  [ONE_REP_MAX_FORMULAS.lombardi]: "Lombardi",
};

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

      <p className={styles.sectionLabel}>Odabir vježbe u Logu</p>

      <label className={styles.checkboxRow}>
        <input
          type="radio"
          name="exercisePickerMode"
          checked={(settings?.exercisePickerMode ?? "chips") === "chips"}
          onChange={() =>
            setSettings((prev) => ({ ...prev, exercisePickerMode: "chips" }))
          }
        />
        Chips (filter iznad liste)
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="radio"
          name="exercisePickerMode"
          checked={settings?.exercisePickerMode === "twoStep"}
          onChange={() =>
            setSettings((prev) => ({ ...prev, exercisePickerMode: "twoStep" }))
          }
        />
        Dvokorak (prvo kategorija, pa vježba)
      </label>

      <p className={styles.sectionLabel}>Setovi</p>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showE1rm ?? true}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              showE1rm: event.target.checked,
            }))
          }
        />
        Prikaži e1RM uz svaki set
      </label>

      {Object.values(ONE_REP_MAX_FORMULAS).map((formula) => (
        <label key={formula} className={styles.checkboxRow}>
          <input
            type="radio"
            name="e1rmFormula"
            checked={(settings?.e1rmFormula ?? "brzycki") === formula}
            onChange={() =>
              setSettings((prev) => ({ ...prev, e1rmFormula: formula }))
            }
          />
          {E1RM_FORMULA_LABELS[formula]}
        </label>
      ))}

      <button className={styles.saveButton} onClick={save}>
        Spremi
      </button>
    </div>
  );
}

export default Settings;
