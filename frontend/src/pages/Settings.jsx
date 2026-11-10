import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { downloadFile, fetchJson, getToken, setToken, UNAUTHORIZED_EVENT } from "../api";
import { ONE_REP_MAX_FORMULAS } from "../utils/oneRepMax";
import { SEXES } from "../utils/strengthScores";
import { useToast } from "../context/useToast";
import styles from "./Settings.module.css";

const LIFT_SETTING_FIELDS = [
  { lift: "squat", field: "squatExercise" },
  { lift: "bench", field: "benchExercise" },
  { lift: "deadlift", field: "deadliftExercise" },
];

const GOAL_FIELDS = ["kcalGoal", "proteinGoal", "trainingsPerWeek", "carbsGoal", "fatGoal"];

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
  { value: "glass", label: "Glass" },
];

function Settings() {
  const { t, i18n } = useTranslation();
  const { showError, showSuccess } = useToast();
  const [settings, setSettings] = useState(null);
  // Goal fields being typed in, by field name; saved when the field is left.
  const [goalDrafts, setGoalDrafts] = useState({});
  const [exerciseTemplates, setExerciseTemplates] = useState([]);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson("/api/exercise-templates")
      .then((data) => setExerciseTemplates(data))
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

  // Every change saves right away; the screen updates first and goes back if saving fails.
  const updateSettings = (patch) => {
    const previousSettings = settings;
    setSettings((prev) => ({ ...prev, ...patch }));
    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch((err) => {
      console.error(err);
      showError(err.message || t("settings.saveError"));
      setSettings(previousSettings);
    });
  };

  // Anything but a whole number of zero or more puts the saved goal back.
  const commitGoal = (field) => {
    const draft = goalDrafts[field];
    if (draft === undefined) return;
    setGoalDrafts((drafts) => {
      const next = { ...drafts };
      delete next[field];
      return next;
    });
    const value = Number(draft);
    if (draft.trim() === "" || !Number.isInteger(value) || value < 0) return;
    if (value !== settings?.[field]) updateSettings({ [field]: value });
  };

  const download = (path, fallbackName) => {
    downloadFile(path, fallbackName).catch((err) => {
      console.error(err);
      showError(err.message);
    });
  };

  const importBackup = async (file) => {
    if (!file) return;
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      showError(t("settings.backupInvalidFile"));
      return;
    }
    if (!window.confirm(t("settings.backupConfirmImport", { name: file.name }))) return;

    fetchJson("/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backup),
    })
      .then(() => {
        showSuccess(t("settings.backupImported"));
        // Everything changed, including theme and language: start fresh.
        window.location.reload();
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const logout = () => {
    setToken(null);
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("settings.title")}</h1>
      <p className={styles.autoSaveHint}>{t("settings.autoSaveHint")}</p>

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
              style={{
                backgroundColor: THEMES.find(
                  (theme) => theme.value === (settings?.theme || "dark-red"),
                )?.swatch,
              }}
            />
            <span>
              {THEMES.find((theme) => theme.value === (settings?.theme || "dark-red"))?.label}
            </span>
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
            <span>
              {
                TEMPLATES.find((template) => template.value === (settings?.template || "terminal"))
                  ?.label
              }
            </span>
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

      {GOAL_FIELDS.map((field) => (
        <div key={field} className={styles.field}>
          <span className={styles.fieldLabel}>{t(`settings.${field}`)}</span>
          <input
            type="number"
            min="0"
            className={styles.fieldInput}
            value={goalDrafts[field] ?? settings?.[field] ?? ""}
            onChange={(event) =>
              setGoalDrafts((drafts) => ({ ...drafts, [field]: event.target.value }))
            }
            onBlur={() => commitGoal(field)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.target.blur();
            }}
          />
        </div>
      ))}

      <p className={styles.sectionLabel}>{t("settings.dashboardWidgets")}</p>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showWorkoutWidget ?? true}
          onChange={(event) => updateSettings({ showWorkoutWidget: event.target.checked })}
        />
        {t("settings.showWorkoutWidget")}
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showNutritionWidget ?? true}
          onChange={(event) => updateSettings({ showNutritionWidget: event.target.checked })}
        />
        {t("settings.showNutritionWidget")}
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showPrWidget ?? true}
          onChange={(event) => updateSettings({ showPrWidget: event.target.checked })}
        />
        {t("settings.showPrWidget")}
      </label>

      <p className={styles.sectionLabel}>{t("settings.exercisePickerSection")}</p>

      <label className={styles.checkboxRow}>
        <input
          type="radio"
          name="exercisePickerMode"
          checked={(settings?.exercisePickerMode ?? "chips") === "chips"}
          onChange={() => updateSettings({ exercisePickerMode: "chips" })}
        />
        {t("settings.exercisePickerChips")}
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="radio"
          name="exercisePickerMode"
          checked={settings?.exercisePickerMode === "twoStep"}
          onChange={() => updateSettings({ exercisePickerMode: "twoStep" })}
        />
        {t("settings.exercisePickerTwoStep")}
      </label>

      <p className={styles.sectionLabel}>{t("settings.setsSection")}</p>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showE1rm ?? true}
          onChange={(event) => updateSettings({ showE1rm: event.target.checked })}
        />
        {t("settings.showE1rm")}
      </label>

      {Object.values(ONE_REP_MAX_FORMULAS).map((formula) => (
        <label key={formula} className={styles.checkboxRow}>
          <input
            type="radio"
            name="e1rmFormula"
            checked={(settings?.e1rmFormula ?? "brzycki") === formula}
            onChange={() => updateSettings({ e1rmFormula: formula })}
          />
          {E1RM_FORMULA_LABELS[formula]}
        </label>
      ))}

      <p className={styles.sectionLabel}>{t("settings.powerliftingSection")}</p>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showPowerliftingTotal ?? false}
          onChange={(event) => updateSettings({ showPowerliftingTotal: event.target.checked })}
        />
        {t("settings.showPowerliftingTotal")}
      </label>

      {/* Sex and the three lifts only feed the powerlifting numbers, so they hide with them. */}
      {settings?.showPowerliftingTotal &&
        Object.values(SEXES).map((sex) => (
          <label key={sex} className={styles.checkboxRow}>
            <input
              type="radio"
              name="sex"
              checked={(settings?.sex ?? SEXES.male) === sex}
              onChange={() => updateSettings({ sex })}
            />
            {t(`settings.sexes.${sex}`)}
          </label>
        ))}

      {settings?.showPowerliftingTotal &&
        LIFT_SETTING_FIELDS.map(({ lift, field }, index) => (
          <div
            key={field}
            className={index === 0 ? `${styles.field} ${styles.firstLiftField}` : styles.field}
          >
            <span className={styles.fieldLabel}>{t(`stats.lifts.${lift}`)}</span>
            <select
              className={styles.liftSelect}
              value={settings?.[field] || ""}
              onChange={(event) => updateSettings({ [field]: event.target.value || null })}
            >
              <option value="">{t("settings.liftAuto")}</option>
              {settings?.[field] &&
                !exerciseTemplates.some((template) => template.name === settings[field]) && (
                  <option value={settings[field]}>{settings[field]}</option>
                )}
              {exerciseTemplates.map((template) => (
                <option key={template.id} value={template.name}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        ))}

      <p className={styles.sectionLabel}>{t("settings.backupSection")}</p>
      <p className={styles.backupHint}>{t("settings.backupHint")}</p>
      <div className={styles.backupActions}>
        <button
          type="button"
          className={styles.backupButton}
          onClick={() => download("/api/backup/export", "ironlog-backup.json")}
        >
          {t("settings.backupExportJson")}
        </button>
        <button
          type="button"
          className={styles.backupButton}
          onClick={() => download("/api/backup/sets.csv", "ironlog-sets.csv")}
        >
          {t("settings.backupExportCsv")}
        </button>
        <label className={styles.backupButton}>
          {t("settings.backupImport")}
          <input
            type="file"
            accept="application/json,.json"
            className={styles.hiddenFileInput}
            onChange={(event) => {
              importBackup(event.target.files[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {getToken() && (
        <button type="button" className={styles.logoutButton} onClick={logout}>
          {t("auth.logout")}
        </button>
      )}
    </div>
  );
}

export default Settings;
