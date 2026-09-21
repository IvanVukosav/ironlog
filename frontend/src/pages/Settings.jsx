import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { ONE_REP_MAX_FORMULAS } from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import styles from "./Settings.module.css";

const E1RM_FORMULA_LABELS = {
  [ONE_REP_MAX_FORMULAS.brzycki]: "Brzycki",
  [ONE_REP_MAX_FORMULAS.epley]: "Epley",
  [ONE_REP_MAX_FORMULAS.lombardi]: "Lombardi",
};

const THEMES = [
  { value: "dark-red", label: "Dark Red", swatch: "#ff3b3b" },
  { value: "light", label: "Light", swatch: "#c62828" },
  { value: "dark-blue", label: "Dark Blue", swatch: "#3ba7ff" },
  { value: "dark-green", label: "Dark Green", swatch: "#3ec95c" },
  { value: "amber", label: "Amber", swatch: "#ffb020" },
  { value: "pure-black", label: "Pure Black", swatch: "#ffffff" },
];

const TEMPLATES = [
  { value: "terminal", label: "Terminal" },
  { value: "soft", label: "Soft" },
  { value: "neon", label: "Neon" },
  { value: "warm", label: "Warm" },
  { value: "glass", label: "Glass" },
  { value: "material", label: "Material" },
];

function Settings() {
  const { t, i18n } = useTranslation();
  const { showError, showSuccess } = useToast();
  const [settings, setSettings] = useState(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [showError]);

  useEffect(() => {
    if (!themeMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (!event.target.closest("[data-theme-menu]")) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [themeMenuOpen]);

  useEffect(() => {
    if (!templateMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (!event.target.closest("[data-template-menu]")) {
        setTemplateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [templateMenuOpen]);

  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    setSettings((prev) => ({ ...prev, language: lang }));
    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    }).catch((err) => {
      console.error(err);
      showError(err.message);
    });
  };

  const changeTheme = (theme) => {
    if (theme === "dark-red") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    setSettings((prev) => ({ ...prev, theme }));
    setThemeMenuOpen(false);
    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    }).catch((err) => {
      console.error(err);
      showError(err.message);
    });
  };

  const changeTemplate = (template) => {
    if (template === "terminal") {
      document.documentElement.removeAttribute("data-template");
    } else {
      document.documentElement.setAttribute("data-template", template);
    }
    setSettings((prev) => ({ ...prev, template }));
    setTemplateMenuOpen(false);
    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template }),
    }).catch((err) => {
      console.error(err);
      showError(err.message);
    });
  };

  const save = () => {
    const fields = [settings.kcalGoal, settings.proteinGoal, settings.trainingsPerWeek, settings.carbsGoal, settings.fatGoal];
    if (fields.some((field) => !field && field !== 0)) {
      showError(t("settings.allFieldsRequired"));
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
      .then(() => showSuccess(t("settings.saved")))
      .catch((err) => {
        console.error(err);
        showError(err.message || t("settings.saveError"));
      });
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("settings.title")}</h1>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("settings.language")}</span>
        <select
          className={styles.languageSelect}
          value={settings?.language || "hr"}
          onChange={(event) => changeLanguage(event.target.value)}
        >
          <option value="hr">Hrvatski</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("settings.theme")}</span>
        <div className={styles.themePicker} data-theme-menu>
          <button
            type="button"
            className={styles.themeTrigger}
            onClick={() => setThemeMenuOpen((prev) => !prev)}
          >
            <span
              className={styles.themeDot}
              style={{ backgroundColor: THEMES.find((theme) => theme.value === (settings?.theme || "dark-red"))?.swatch }}
            />
            <span>{THEMES.find((theme) => theme.value === (settings?.theme || "dark-red"))?.label}</span>
            <span className={styles.themeCaret}>{themeMenuOpen ? "▴" : "▾"}</span>
          </button>
          {themeMenuOpen && (
            <div className={styles.themeDropdown}>
              {THEMES.map((theme) => (
                <button
                  type="button"
                  key={theme.value}
                  className={
                    theme.value === (settings?.theme || "dark-red")
                      ? `${styles.themeOption} ${styles.themeOptionActive}`
                      : styles.themeOption
                  }
                  onClick={() => changeTheme(theme.value)}
                >
                  <span className={styles.themeDot} style={{ backgroundColor: theme.swatch }} />
                  <span>{theme.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("settings.template")}</span>
        <div className={styles.themePicker} data-template-menu>
          <button
            type="button"
            className={styles.themeTrigger}
            onClick={() => setTemplateMenuOpen((prev) => !prev)}
          >
            <span>{TEMPLATES.find((template) => template.value === (settings?.template || "terminal"))?.label}</span>
            <span className={styles.themeCaret}>{templateMenuOpen ? "▴" : "▾"}</span>
          </button>
          {templateMenuOpen && (
            <div className={styles.themeDropdown}>
              {TEMPLATES.map((template) => (
                <button
                  type="button"
                  key={template.value}
                  className={
                    template.value === (settings?.template || "terminal")
                      ? `${styles.themeOption} ${styles.themeOptionActive}`
                      : styles.themeOption
                  }
                  onClick={() => changeTemplate(template.value)}
                >
                  <span>{template.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("settings.kcalGoal")}</span>
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
        <span className={styles.fieldLabel}>{t("settings.proteinGoal")}</span>
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
        <span className={styles.fieldLabel}>{t("settings.trainingsPerWeek")}</span>
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
        <span className={styles.fieldLabel}>{t("settings.carbsGoal")}</span>
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
        <span className={styles.fieldLabel}>{t("settings.fatGoal")}</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.fatGoal || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, fatGoal: event.target.value }))
          }
        />
      </div>

      <p className={styles.sectionLabel}>{t("settings.dashboardWidgets")}</p>

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
        {t("settings.showWorkoutWidget")}
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
        {t("settings.showNutritionWidget")}
      </label>

      <p className={styles.sectionLabel}>{t("settings.exercisePickerSection")}</p>

      <label className={styles.checkboxRow}>
        <input
          type="radio"
          name="exercisePickerMode"
          checked={(settings?.exercisePickerMode ?? "chips") === "chips"}
          onChange={() =>
            setSettings((prev) => ({ ...prev, exercisePickerMode: "chips" }))
          }
        />
        {t("settings.exercisePickerChips")}
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
        {t("settings.exercisePickerTwoStep")}
      </label>

      <p className={styles.sectionLabel}>{t("settings.setsSection")}</p>

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
        {t("settings.showE1rm")}
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
        {t("settings.save")}
      </button>
    </div>
  );
}

export default Settings;
