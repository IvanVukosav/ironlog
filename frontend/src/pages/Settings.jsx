import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { downloadFile, fetchJson, getToken, setToken, UNAUTHORIZED_EVENT } from "../api";
import { DEFAULT_E1RM_FORMULA, E1RM_FORMULAS } from "../utils/oneRepMax";
import { DEFAULT_REST_SECONDS, formatClock, REST_CHOICES_SECONDS } from "../utils/activeWorkout";
import { useToast } from "../context/useToast";
import { useSettings } from "../context/useSettings";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useReportError } from "../hooks/useReportError";
import { useScrollSpy } from "../hooks/useScrollSpy";
import Icon from "../components/Icon";
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

// From this width Postavke is one page: a menu beside every section, each setting a row with
// its control on the right. Narrower, as on a phone, it is a list of sections, each opening on
// its own (?section=…), and Back returns to the list.
const WIDE_SCREEN = "(min-width: 900px)";

// The page's sections in order. `title` and `nav` are keys under "settings." (`nav` when the
// menu says it shorter); "settings.<id>About" says what is in a section.
const SECTIONS = [
  { id: "appearance", icon: "appearance", title: "appearanceSection" },
  { id: "goals", icon: "goals", title: "goalsSection" },
  { id: "training", icon: "workout", title: "trainingSection" },
  { id: "home", icon: "home", title: "homeSection", nav: "homeNav" },
  { id: "powerlifting", icon: "trophy", title: "powerliftingSection" },
  { id: "backup", icon: "backup", title: "backupSection" },
];
const SECTION_PARAM = "section";
// A section's element on the wide page, for the menu to jump to and follow.
const anchorOf = (id) => `settings-${id}`;
const SECTION_ANCHORS = SECTIONS.map((section) => anchorOf(section.id));

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

// A setting's name, and what it does under it.
function RowText({ label, hint }) {
  return (
    <span className={styles.rowText}>
      <span className={styles.rowLabel}>{label}</span>
      {hint && <span className={styles.rowHint}>{hint}</span>}
    </span>
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

  const isWide = useMediaQuery(WIDE_SCREEN);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requested = searchParams.get(SECTION_PARAM);
  const openSection = SECTIONS.some((section) => section.id === requested) ? requested : null;
  const [readingAnchor, selectAnchor] = useScrollSpy(SECTION_ANCHORS, isWide);
  // The section a link (?section=…) has already been brought into view for.
  const linkedSection = useRef(null);
  const settingsLoaded = Boolean(settings);

  useEffect(() => {
    const load = (path, onData) => fetchJson(path).then(onData).catch(reportError);

    load("/api/stats/prs", setExerciseSets);
    load(`/api/bodyweight?days=${BODYWEIGHT_LOOKBACK_DAYS}`, (entries) =>
      setLatestBodyweight(entries.at(-1) ?? null),
    );
  }, [reportError]);

  // A link to a section (?section=…) brings it into view on the wide page too, once: after the
  // settings are in, as before that the page is shorter and can't scroll down far enough.
  useEffect(() => {
    if (!isWide || !openSection || !settingsLoaded || linkedSection.current === openSection) return;
    linkedSection.current = openSection;
    selectAnchor(anchorOf(openSection));
    document.getElementById(anchorOf(openSection))?.scrollIntoView({ block: "start" });
  }, [isWide, openSection, settingsLoaded, selectAnchor]);

  // A section opened from the list is a step Back undoes; one reached by a link goes to the list.
  const showSection = (id) =>
    setSearchParams({ [SECTION_PARAM]: id }, { state: { fromList: true } });
  const showList = () => {
    if (location.state?.fromList) navigate(-1);
    else setSearchParams({}, { replace: true });
  };
  const jumpTo = (id) => {
    selectAnchor(anchorOf(id));
    document.getElementById(anchorOf(id))?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const language = settings?.language || DEFAULT_LANGUAGE;
  const theme = settings?.theme || DEFAULT_THEME;
  const template = settings?.template || DEFAULT_TEMPLATE;
  const restSeconds = settings?.restSeconds ?? DEFAULT_REST_SECONDS;
  const formula = settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA;
  const formulaLabel = (E1RM_FORMULAS[formula] ?? E1RM_FORMULAS[DEFAULT_E1RM_FORMULA]).label;
  const themeOptions = THEMES.map((option) => ({
    value: option.value,
    label: option.labelKey ? t(option.labelKey) : option.label,
    swatch: option.swatch,
  }));
  const restLabel = (seconds) =>
    seconds === 0 ? t("settings.restOff") : formatClock(seconds * 1000);
  const homeCards = [
    { field: "showWorkoutWidget", label: t("dashboard.workoutToday") },
    { field: "showNutritionWidget", label: t("dashboard.nutritionToday") },
    { field: "showPrWidget", label: t("dashboard.latestPr") },
  ];

  // What each section holds, the same in either layout: on the wide page every child is a row.
  const content = {
    appearance: (
      <>
        <div className={styles.row}>
          <RowText label={t("settings.language")} />
          <SegmentedControl
            compact
            label={t("settings.language")}
            options={LANGUAGES}
            value={language}
            onChange={change("language")}
          />
        </div>
        <div className={styles.block}>
          <RowText label={t("settings.theme")} hint={t("settings.themeHint")} />
          <ChipGroup
            label={t("settings.theme")}
            options={themeOptions}
            value={theme}
            onChange={change("theme")}
          />
        </div>
        <div className={styles.block}>
          <RowText label={t("settings.template")} />
          <ChipGroup
            label={t("settings.template")}
            options={TEMPLATES}
            value={template}
            onChange={change("template")}
          />
        </div>
      </>
    ),
    goals: (
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
    ),
    training: (
      <>
        <div className={styles.block}>
          <RowText label={t("settings.restLabel")} hint={t("settings.restHint")} />
          <ChipGroup
            label={t("settings.restLabel")}
            options={REST_CHOICES_SECONDS.map((seconds) => ({
              value: seconds,
              label: restLabel(seconds),
            }))}
            value={restSeconds}
            onChange={change("restSeconds")}
          />
        </div>
        <SwitchRow
          label={t("settings.showE1rm")}
          checked={settings?.showE1rm ?? true}
          onChange={change("showE1rm")}
        />
        <div className={styles.row}>
          <RowText label={t("settings.e1rmFormula")} />
          <SegmentedControl
            compact
            label={t("settings.e1rmFormula")}
            options={Object.entries(E1RM_FORMULAS).map(([value, { label }]) => ({ value, label }))}
            value={formula}
            onChange={change("e1rmFormula")}
          />
        </div>
        <div className={styles.row}>
          <RowText label={t("settings.exercisePicker")} />
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
      </>
    ),
    home: (
      <>
        {homeCards.map((card) => (
          <SwitchRow
            key={card.field}
            label={card.label}
            checked={settings?.[card.field] ?? true}
            onChange={change(card.field)}
          />
        ))}
      </>
    ),
    powerlifting: (
      <>
        <SwitchRow
          label={t("settings.showPowerliftingTotal")}
          hint={t("settings.powerliftingHint")}
          checked={settings?.showPowerliftingTotal ?? false}
          onChange={change("showPowerliftingTotal")}
        />
        {/* Sex and the three lifts only feed the powerlifting numbers, so they hide with them. */}
        {settings?.showPowerliftingTotal && (
          <div className={styles.subsection}>
            <PowerliftingSetup
              settings={settings}
              exerciseSets={exerciseSets}
              bodyweight={latestBodyweight}
              onChange={updateSettings}
            />
          </div>
        )}
      </>
    ),
    backup: (
      <>
        <div className={styles.row}>
          <RowText label={t("settings.backupJsonLabel")} hint={t("settings.backupJsonHint")} />
          <button
            type="button"
            className={styles.secondaryButton}
            aria-label={t("settings.backupExportJson")}
            onClick={() => download("/api/backup/export", "ironlog-backup.json")}
          >
            {t("settings.backupDownload")}
          </button>
        </div>
        <div className={styles.row}>
          <RowText label={t("settings.backupCsvLabel")} hint={t("settings.backupCsvHint")} />
          <button
            type="button"
            className={styles.secondaryButton}
            aria-label={t("settings.backupExportCsv")}
            onClick={() => download("/api/backup/sets.csv", "ironlog-sets.csv")}
          >
            {t("settings.backupExport")}
          </button>
        </div>
        <div className={styles.row}>
          <RowText
            label={t("settings.backupRestoreLabel")}
            hint={t("settings.backupRestoreHint")}
          />
          {/* The file box itself is invisible but still reached with Tab; the label is its face. */}
          <label className={styles.fileButton}>
            {t("settings.backupChooseFile")}
            <input
              type="file"
              accept="application/json,.json"
              aria-label={t("settings.backupImport")}
              className={styles.fileInput}
              onChange={(event) => {
                importBackup(event.target.files[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </>
    ),
  };

  // How each section is set now, in a line under its name in the list.
  const goalCount = (field) => settings?.[field] ?? "–";
  const summaries = {
    appearance: [
      LANGUAGES.find((option) => option.value === language)?.label,
      themeOptions.find((option) => option.value === theme)?.label,
      TEMPLATES.find((option) => option.value === template)?.label,
    ].join(" · "),
    goals: t("settings.goalsSummary", {
      kcal: goalCount("kcalGoal"),
      protein: goalCount("proteinGoal"),
    }),
    training:
      restSeconds === 0
        ? t("settings.trainingSummaryNoRest", { formula: formulaLabel })
        : t("settings.trainingSummary", { rest: restLabel(restSeconds), formula: formulaLabel }),
    home: t("settings.homeSummary", {
      on: homeCards.filter((card) => settings?.[card.field] ?? true).length,
      total: homeCards.length,
    }),
    powerlifting: settings?.showPowerliftingTotal
      ? t("settings.powerliftingOn")
      : t("settings.powerliftingOff"),
    backup: t("settings.backupSummary"),
  };

  const titleOf = (section) => t(`settings.${section.title}`);
  const logoutButton = getToken() && (
    <button type="button" className={styles.logoutButton} onClick={logout}>
      {t("auth.logout")}
    </button>
  );
  const pageHeader = (
    <header className={styles.header}>
      <h1 className={styles.heading}>{t("settings.title")}</h1>
      <p className={styles.headerHint}>{t("settings.autoSaveHint")}</p>
    </header>
  );

  if (isWide) {
    return (
      <div className={styles.wide}>
        <aside className={styles.aside}>
          {pageHeader}
          <nav className={styles.sectionNav} aria-label={t("settings.sectionsNav")}>
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${anchorOf(section.id)}`}
                className={styles.sectionLink}
                aria-current={anchorOf(section.id) === readingAnchor ? "true" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  jumpTo(section.id);
                }}
              >
                <NavIcon name={section.icon} size={18} />
                {t(`settings.${section.nav ?? section.title}`)}
              </a>
            ))}
          </nav>
          {logoutButton}
        </aside>

        <div className={styles.sections}>
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={anchorOf(section.id)}
              className={styles.section}
              aria-labelledby={`${anchorOf(section.id)}-title`}
            >
              <div>
                <h2 id={`${anchorOf(section.id)}-title`} className={styles.sectionTitle}>
                  {titleOf(section)}
                </h2>
                <p className={styles.sectionAbout}>{t(`settings.${section.id}About`)}</p>
              </div>
              <div className={styles.table}>{content[section.id]}</div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  if (openSection) {
    const section = SECTIONS.find((item) => item.id === openSection);
    return (
      <div className={styles.page}>
        <button type="button" className={styles.backLink} onClick={showList}>
          <Icon name="chevronLeft" size={22} />
          {t("settings.title")}
        </button>
        <header className={styles.header}>
          <h1 className={styles.heading}>{titleOf(section)}</h1>
          <p className={styles.headerHint}>{t(`settings.${section.id}About`)}</p>
        </header>
        <section className={styles.card} aria-label={titleOf(section)}>
          {content[openSection]}
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {pageHeader}
      <nav className={styles.list} aria-label={t("settings.sectionsNav")}>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={styles.listItem}
            onClick={() => showSection(section.id)}
          >
            <span className={styles.listIcon} aria-hidden="true">
              <NavIcon name={section.icon} size={18} />
            </span>
            <span className={styles.listText}>
              <span className={styles.listTitle}>{titleOf(section)}</span>
              <span className={styles.listSummary}>{summaries[section.id]}</span>
            </span>
            <span className={styles.listChevron} aria-hidden="true">
              <Icon name="chevronRight" size={18} />
            </span>
          </button>
        ))}
      </nav>
      {logoutButton}
    </div>
  );
}

export default Settings;
