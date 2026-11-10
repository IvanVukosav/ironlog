import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { downloadFile, fetchJson, getToken, setToken, UNAUTHORIZED_EVENT } from "../api";
import { DEFAULT_E1RM_FORMULA, E1RM_FORMULAS } from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import PowerliftingSetup from "../components/PowerliftingSetup";
import styles from "./Settings.module.css";

const BODYWEIGHT_LOOKBACK_DAYS = 3650;

const GOAL_FIELDS = ["kcalGoal", "proteinGoal", "trainingsPerWeek", "carbsGoal", "fatGoal"];

const DEFAULT_THEME = "auto";
const DEFAULT_TEMPLATE = "moderna";

const THEMES = [
  // Follows the device: Graphite in dark mode, Daylight in light mode.
  {
    value: "auto",
    labelKey: "settings.themeAuto",
    swatch: "linear-gradient(90deg, #0f1115 50%, #f4f5f7 50%)",
  },
  { value: "graphite", label: "Graphite", swatch: "#5b9bff" },
  { value: "daylight", label: "Daylight", swatch: "#c2361c" },
  { value: "dark-red", label: "Dark Red", swatch: "#ff3b3b" },
  { value: "light", label: "Light", swatch: "#c62828" },
  { value: "dark-blue", label: "Dark Blue", swatch: "#3ba7ff" },
  { value: "dark-green", label: "Dark Green", swatch: "#3ec95c" },
  { value: "amber", label: "Amber", swatch: "#ffb020" },
  { value: "pure-black", label: "Pure Black", swatch: "#ffffff" },
];

const TEMPLATES = [
  { value: "moderna", label: "Moderna" },
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
  // Logged exercises with their sets and the latest bodyweight, for the powerlifting setup.
  const [exerciseSets, setExerciseSets] = useState([]);
  const [latestBodyweight, setLatestBodyweight] = useState(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  useEffect(() => {
    const load = (path, onData) =>
      fetchJson(path)
        .then(onData)
        .catch((err) => {
          console.error(err);
          showError(err.message);
        });

    load("/api/settings", setSettings);
    load("/api/stats/prs", setExerciseSets);
    load(`/api/bodyweight?days=${BODYWEIGHT_LOOKBACK_DAYS}`, (entries) =>
      setLatestBodyweight(entries.at(-1) ?? null),
    );
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
    document.documentElement.setAttribute("data-theme", theme);
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
    document.documentElement.setAttribute("data-template", template);
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

  const currentTheme = THEMES.find((theme) => theme.value === (settings?.theme || DEFAULT_THEME));
  const themeLabel = (theme) => (theme.labelKey ? t(theme.labelKey) : theme.label);

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
            <span className={styles.themeDot} style={{ background: currentTheme?.swatch }} />
            <span>{currentTheme && themeLabel(currentTheme)}</span>
            <span className={styles.themeCaret}>{themeMenuOpen ? "▴" : "▾"}</span>
          </button>
          {themeMenuOpen && (
            <div className={styles.themeDropdown}>
              {THEMES.map((theme) => (
                <button
                  type="button"
                  key={theme.value}
                  className={
                    theme.value === currentTheme?.value
                      ? `${styles.themeOption} ${styles.themeOptionActive}`
                      : styles.themeOption
                  }
                  onClick={() => changeTheme(theme.value)}
                >
                  <span className={styles.themeDot} style={{ background: theme.swatch }} />
                  <span>{themeLabel(theme)}</span>
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
                TEMPLATES.find(
                  (template) => template.value === (settings?.template || DEFAULT_TEMPLATE),
                )?.label
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
                    template.value === (settings?.template || DEFAULT_TEMPLATE)
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

      {Object.entries(E1RM_FORMULAS).map(([formula, { label }]) => (
        <label key={formula} className={styles.checkboxRow}>
          <input
            type="radio"
            name="e1rmFormula"
            checked={(settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA) === formula}
            onChange={() => updateSettings({ e1rmFormula: formula })}
          />
          {label}
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
      <p className={styles.optionHint}>{t("settings.powerliftingHint")}</p>

      {/* Sex and the three lifts only feed the powerlifting numbers, so they hide with them. */}
      {settings?.showPowerliftingTotal && (
        <PowerliftingSetup
          settings={settings}
          exerciseSets={exerciseSets}
          bodyweight={latestBodyweight}
          onChange={updateSettings}
        />
      )}

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
