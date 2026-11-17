import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { downloadFile, fetchJson, getToken, setToken, UNAUTHORIZED_EVENT } from "../api";
import { DEFAULT_E1RM_FORMULA, E1RM_FORMULAS } from "../utils/oneRepMax";
import { DEFAULT_REST_SECONDS, formatClock, REST_CHOICES_SECONDS } from "../utils/activeWorkout";
import { useToast } from "../context/useToast";
import { useSettings } from "../context/useSettings";
import { useReportError } from "../hooks/useReportError";
import NavIcon from "../components/NavIcon";
import NumberField from "../components/NumberField";
import PowerliftingSetup from "../components/PowerliftingSetup";
import SegmentedControl from "../components/SegmentedControl";
import SwitchRow from "../components/SwitchRow";
import styles from "./Settings.module.css";

const BODYWEIGHT_LOOKBACK_DAYS = 3650;

const GOAL_FIELDS = ["kcalGoal", "proteinGoal", "carbsGoal", "fatGoal", "trainingsPerWeek"];

const DEFAULT_LANGUAGE = "hr";
const DEFAULT_THEME = "auto";
const DEFAULT_TEMPLATE = "moderna";
const DEFAULT_PICKER_MODE = "chips";

// Each language's name in itself, as people look for it.
const LANGUAGES = [
  { value: "hr", label: "Hrvatski" },
  { value: "en", label: "English" },
];

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

// The page's sections in order. On a wide screen a menu beside them shows one at a time (the one
// in the address, ?section=…); on a phone they all follow one another. `title` and `nav` are keys
// under "settings." (`nav` when the menu says it shorter); "settings.<id>About" says what is in it.
const SECTIONS = [
  { id: "appearance", icon: "appearance", title: "appearanceSection" },
  { id: "goals", icon: "goals", title: "goalsSection" },
  { id: "training", icon: "workout", title: "trainingSection" },
  { id: "home", icon: "home", title: "homeSection", nav: "homeNav" },
  { id: "powerlifting", icon: "trophy", title: "powerliftingSection" },
  { id: "backup", icon: "backup", title: "backupSection" },
];
const SECTION_PARAM = "section";

// A section of settings: on a phone a card under a small title. On a wide screen (CSS) the title
// is a heading over the card, with what the section holds, and only the open section shows.
function Section({ id, isOpen, children }) {
  const { t } = useTranslation();
  const headingId = useId();
  const { title } = SECTIONS.find((section) => section.id === id);
  return (
    <section className={styles.section} data-open={isOpen} aria-labelledby={headingId}>
      <div>
        <h2 id={headingId} className={styles.sectionTitle}>
          {t(`settings.${title}`)}
        </h2>
        <p className={styles.sectionAbout}>{t(`settings.${id}About`)}</p>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

// One choice out of several, as chips that wrap; `options` are { value, label, swatch? }.
function ChipGroup({ label, options, value, onChange }) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.chip}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.swatch && (
            <span
              className={styles.swatch}
              style={{ background: option.swatch }}
              aria-hidden="true"
            />
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Settings() {
  const { t } = useTranslation();
  const { showError, showSuccess } = useToast();
  const reportError = useReportError();
  // Every change saves right away; the screen updates first and goes back if saving fails.
  const { settings, updateSettings } = useSettings();
  // Goal fields being typed in, by field name; saved when the field is left.
  const [goalDrafts, setGoalDrafts] = useState({});
  // Logged exercises with their sets and the latest bodyweight, for the powerlifting setup.
  const [exerciseSets, setExerciseSets] = useState([]);
  const [latestBodyweight, setLatestBodyweight] = useState(null);

  useEffect(() => {
    const load = (path, onData) => fetchJson(path).then(onData).catch(reportError);

    load("/api/stats/prs", setExerciseSets);
    load(`/api/bodyweight?days=${BODYWEIGHT_LOOKBACK_DAYS}`, (entries) =>
      setLatestBodyweight(entries.at(-1) ?? null),
    );
  }, [reportError]);

  // Anything but a whole number of zero or more puts the saved goal back.
  const commitGoal = (field) => {
    const draft = goalDrafts[field];
    if (draft === undefined) return;
    setGoalDrafts((drafts) => {
      const next = { ...drafts };
      delete next[field];
      return next;
    });
    const value = Number(draft.trim());
    if (draft.trim() === "" || !Number.isInteger(value) || value < 0) return;
    if (value !== settings?.[field]) updateSettings({ [field]: value });
  };

  const download = (path, fallbackName) => {
    downloadFile(path, fallbackName).catch(reportError);
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
      json: backup,
    })
      .then(() => {
        showSuccess(t("settings.backupImported"));
        // Everything changed, including theme and language: start fresh.
        window.location.reload();
      })
      .catch(reportError);
  };

  const logout = () => {
    setToken(null);
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  };

  // The page's theme, template and language follow the settings (SettingsProvider).
  const change = (field) => (value) => updateSettings({ [field]: value });

  // The open section is kept in the address, so a reload or a link keeps it; the first is the
  // default and leaves the address clean. Choosing one replaces the address: Back leaves the page.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(SECTION_PARAM);
  const openSection = SECTIONS.some((section) => section.id === requested)
    ? requested
    : SECTIONS[0].id;
  const openSectionNamed = (id) =>
    setSearchParams(id === SECTIONS[0].id ? {} : { [SECTION_PARAM]: id }, { replace: true });
  const sectionProps = (id) => ({ id, isOpen: id === openSection });

  return (
    <div className={styles.page}>
      <aside>
        <header className={styles.header}>
          <h1 className={styles.heading}>{t("settings.title")}</h1>
          <p className={styles.headerHint}>{t("settings.autoSaveHint")}</p>
        </header>
        <nav className={styles.sectionNav} aria-label={t("settings.sectionsNav")}>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={styles.sectionLink}
              aria-current={section.id === openSection ? "true" : undefined}
              onClick={() => openSectionNamed(section.id)}
            >
              <NavIcon name={section.icon} size={18} />
              {t(`settings.${section.nav ?? section.title}`)}
            </button>
          ))}
        </nav>
      </aside>

      <div className={styles.content}>
        <Section {...sectionProps("appearance")}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t("settings.language")}</span>
            <SegmentedControl
              compact
              label={t("settings.language")}
              options={LANGUAGES}
              value={settings?.language || DEFAULT_LANGUAGE}
              onChange={change("language")}
            />
          </div>
          <div className={styles.block}>
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{t("settings.theme")}</span>
              <span className={styles.rowHint}>{t("settings.themeHint")}</span>
            </span>
            <ChipGroup
              label={t("settings.theme")}
              options={THEMES.map((theme) => ({
                value: theme.value,
                label: theme.labelKey ? t(theme.labelKey) : theme.label,
                swatch: theme.swatch,
              }))}
              value={settings?.theme || DEFAULT_THEME}
              onChange={change("theme")}
            />
          </div>
          <div className={styles.block}>
            <span className={styles.rowLabel}>{t("settings.template")}</span>
            <ChipGroup
              label={t("settings.template")}
              options={TEMPLATES}
              value={settings?.template || DEFAULT_TEMPLATE}
              onChange={change("template")}
            />
          </div>
        </Section>

        <Section {...sectionProps("goals")}>
          <div className={styles.goals}>
            {GOAL_FIELDS.map((field) => (
              <NumberField
                key={field}
                label={t(`settings.${field}`)}
                inputMode="numeric"
                value={goalDrafts[field] ?? String(settings?.[field] ?? "")}
                onChange={(text) => setGoalDrafts((drafts) => ({ ...drafts, [field]: text }))}
                onBlur={() => commitGoal(field)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            ))}
          </div>
        </Section>

        <Section {...sectionProps("training")}>
          <div className={styles.block}>
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{t("settings.restLabel")}</span>
              <span className={styles.rowHint}>{t("settings.restHint")}</span>
            </span>
            <ChipGroup
              label={t("settings.restLabel")}
              options={REST_CHOICES_SECONDS.map((seconds) => ({
                value: seconds,
                label: seconds === 0 ? t("settings.restOff") : formatClock(seconds * 1000),
              }))}
              value={settings?.restSeconds ?? DEFAULT_REST_SECONDS}
              onChange={change("restSeconds")}
            />
          </div>
          <SwitchRow
            label={t("settings.showE1rm")}
            checked={settings?.showE1rm ?? true}
            onChange={change("showE1rm")}
          />
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t("settings.e1rmFormula")}</span>
            <SegmentedControl
              compact
              label={t("settings.e1rmFormula")}
              options={Object.entries(E1RM_FORMULAS).map(([value, { label }]) => ({
                value,
                label,
              }))}
              value={settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA}
              onChange={change("e1rmFormula")}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t("settings.exercisePicker")}</span>
            <SegmentedControl
              compact
              label={t("settings.exercisePicker")}
              options={[
                { value: "chips", label: t("settings.pickerFilter") },
                { value: "twoStep", label: t("settings.pickerTwoStep") },
              ]}
              value={settings?.exercisePickerMode ?? DEFAULT_PICKER_MODE}
              onChange={change("exercisePickerMode")}
            />
          </div>
        </Section>

        <Section {...sectionProps("home")}>
          <SwitchRow
            label={t("dashboard.workoutToday")}
            checked={settings?.showWorkoutWidget ?? true}
            onChange={change("showWorkoutWidget")}
          />
          <SwitchRow
            label={t("dashboard.nutritionToday")}
            checked={settings?.showNutritionWidget ?? true}
            onChange={change("showNutritionWidget")}
          />
          <SwitchRow
            label={t("dashboard.latestPr")}
            checked={settings?.showPrWidget ?? true}
            onChange={change("showPrWidget")}
          />
        </Section>

        <Section {...sectionProps("powerlifting")}>
          <SwitchRow
            label={t("settings.showPowerliftingTotal")}
            hint={t("settings.powerliftingHint")}
            checked={settings?.showPowerliftingTotal ?? false}
            onChange={change("showPowerliftingTotal")}
          />
          {/* Sex and the three lifts only feed the powerlifting numbers, so they hide with them. */}
          {settings?.showPowerliftingTotal && (
            <PowerliftingSetup
              settings={settings}
              exerciseSets={exerciseSets}
              bodyweight={latestBodyweight}
              onChange={updateSettings}
            />
          )}
        </Section>

        <Section {...sectionProps("backup")}>
          <p className={styles.text}>{t("settings.backupHint")}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => download("/api/backup/export", "ironlog-backup.json")}
            >
              {t("settings.backupExportJson")}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => download("/api/backup/sets.csv", "ironlog-sets.csv")}
            >
              {t("settings.backupExportCsv")}
            </button>
            {/* The file box itself is invisible but still reached with Tab; the label is its face. */}
            <label className={styles.fileButton}>
              {t("settings.backupImport")}
              <input
                type="file"
                accept="application/json,.json"
                className={styles.fileInput}
                onChange={(event) => {
                  importBackup(event.target.files[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </Section>

        {getToken() && (
          <button type="button" className={styles.logoutButton} onClick={logout}>
            {t("auth.logout")}
          </button>
        )}
      </div>
    </div>
  );
}

export default Settings;
