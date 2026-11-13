import { useState, useEffect, useId } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import Icon from "../components/Icon";
import { useReportError } from "../hooks/useReportError";
import { dateKeyOf, formatWeekdayDate, toDateKey, todayKey, todayParts } from "../utils/dates";
import { formatNumber, parseDecimal, toDecimalText, toInputText } from "../utils/numbers";
import styles from "./Calendar.module.css";

const MEASUREMENT_FIELDS = ["waist", "chest", "arms", "thighs", "hips"];
const EMPTY_MEASUREMENTS = Object.fromEntries(MEASUREMENT_FIELDS.map((field) => [field, ""]));
const DAYS_PER_WEEK = 7;
// 1 January 2024 was a Monday: the week the weekday letters are taken from.
const A_MONDAY = Date.UTC(2024, 0, 1);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The month's days in weeks from Monday; null where the grid has no day of this month.
function monthCells(year, month) {
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % DAYS_PER_WEEK;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % DAYS_PER_WEEK !== 0) cells.push(null);
  return cells;
}

// Entries by their day ("2026-11-13"), the way the grid looks them up.
const byDay = (entries) =>
  new Map(entries.map((entry) => [dateKeyOf(new Date(entry.date)), entry]));

function Calendar() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const reportError = useReportError();
  const fieldId = useId();
  const { year: todayYear, month: todayMonth } = todayParts();
  const [today] = useState(todayKey);
  const [view, setView] = useState({ year: todayYear, month: todayMonth });
  const [selected, setSelected] = useState(today);
  const [workouts, setWorkouts] = useState([]);
  const [bodyweights, setBodyweights] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  // Which of the selected day's entries is being edited: "bodyweight", "measurements" or null.
  const [editing, setEditing] = useState(null);
  const [weightInput, setWeightInput] = useState("");
  const [measurementsForm, setMeasurementsForm] = useState(EMPTY_MEASUREMENTS);

  // The previous month's entries can stay until the new ones arrive: the grid only looks up its
  // own days. An answer for a month already left behind is dropped.
  useEffect(() => {
    let isStale = false;
    const load = (path, setData) =>
      fetchJson(path)
        .then((data) => {
          if (!isStale) setData(data);
        })
        .catch(reportError);

    const query = `year=${view.year}&month=${view.month}`;
    load(`/api/workouts/month?${query}`, setWorkouts);
    load(`/api/bodyweight?${query}`, setBodyweights);
    load(`/api/body-measurements?${query}`, setMeasurements);
    return () => {
      isStale = true;
    };
  }, [view, reportError]);

  const workoutByDay = byDay(workouts);
  const weightByDay = byDay(bodyweights);
  const measurementsByDay = byDay(measurements);

  const showMonth = (year, month) => {
    setView({ year, month });
    // Today when the month holds it, else the month's first day.
    setSelected(year === todayYear && month === todayMonth ? today : toDateKey(year, month, 1));
    setEditing(null);
  };

  const changeMonth = (step) => {
    const first = new Date(Date.UTC(view.year, view.month - 1 + step, 1));
    showMonth(first.getUTCFullYear(), first.getUTCMonth() + 1);
  };

  const selectDay = (key) => {
    setSelected(key);
    setEditing(null);
  };

  const selectedWorkout = workoutByDay.get(selected);
  const selectedWeight = weightByDay.get(selected);
  const selectedMeasurements = measurementsByDay.get(selected);

  const kg = (value) => `${formatNumber(value, language, { maxDecimals: 1 })} kg`;
  const cm = (value) => `${formatNumber(value, language, { maxDecimals: 1 })} cm`;
  const workoutName = (workout) => workout.name || t("dashboard.workoutFallbackName");
  const measurementsSummary = (entry) =>
    MEASUREMENT_FIELDS.filter((field) => entry[field] !== null && entry[field] !== undefined)
      .map((field) => `${t(`calendar.measurementFields.${field}`)} ${cm(entry[field])}`)
      .join(" · ");

  // The entry saved for a day replaces whatever the list had for that day.
  const replaceDay = (entries, saved) => [
    ...entries.filter((entry) => dateKeyOf(new Date(entry.date)) !== selected),
    saved,
  ];

  const editWeight = () => {
    setWeightInput(toInputText(selectedWeight?.weight, language));
    setEditing("bodyweight");
  };

  const saveWeight = () => {
    if (!(parseDecimal(weightInput) > 0)) return;
    fetchJson("/api/bodyweight", {
      method: "POST",
      json: { date: selected, weight: toDecimalText(weightInput) },
    })
      .then((saved) => {
        setBodyweights((prev) => replaceDay(prev, saved));
        setEditing(null);
      })
      .catch(reportError);
  };

  const deleteWeight = () => {
    const { id } = selectedWeight;
    fetchJson(`/api/bodyweight/${id}`, { method: "DELETE" })
      .then(() => {
        setBodyweights((prev) => prev.filter((entry) => entry.id !== id));
        setEditing(null);
      })
      .catch(reportError);
  };

  const editMeasurements = () => {
    setMeasurementsForm(
      Object.fromEntries(
        MEASUREMENT_FIELDS.map((field) => [
          field,
          toInputText(selectedMeasurements?.[field], language),
        ]),
      ),
    );
    setEditing("measurements");
  };

  const hasAnyMeasurement = MEASUREMENT_FIELDS.some(
    (field) => measurementsForm[field].trim() !== "",
  );

  const saveMeasurements = () => {
    if (!hasAnyMeasurement) return;
    const values = Object.fromEntries(
      MEASUREMENT_FIELDS.map((field) => [field, toDecimalText(measurementsForm[field])]),
    );
    fetchJson("/api/body-measurements", { method: "POST", json: { date: selected, ...values } })
      .then((saved) => {
        setMeasurements((prev) => replaceDay(prev, saved));
        setEditing(null);
      })
      .catch(reportError);
  };

  const deleteMeasurements = () => {
    const { id } = selectedMeasurements;
    fetchJson(`/api/body-measurements/${id}`, { method: "DELETE" })
      .then(() => {
        setMeasurements((prev) => prev.filter((entry) => entry.id !== id));
        setEditing(null);
      })
      .catch(reportError);
  };

  const weekdayLetter = new Intl.DateTimeFormat(language, { weekday: "narrow", timeZone: "UTC" });
  const monthName = t("common.months", { returnObjects: true })[view.month - 1];
  const isThisMonth = view.year === todayYear && view.month === todayMonth;

  // Escape leaves an edit without saving.
  const cancelOnEscape = (event) => {
    if (event.key === "Escape") setEditing(null);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("nav.calendar")}</h1>

      <div className={styles.monthBar}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t("calendar.previousMonth")}
          onClick={() => changeMonth(-1)}
        >
          <Icon name="chevronLeft" size={20} />
        </button>
        <h2 className={styles.monthHeading} aria-live="polite">
          {`${monthName} ${view.year}`}
        </h2>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t("calendar.nextMonth")}
          onClick={() => changeMonth(1)}
        >
          <Icon name="chevronRight" size={20} />
        </button>
        {!isThisMonth && (
          <button
            type="button"
            className={styles.todayButton}
            onClick={() => showMonth(todayYear, todayMonth)}
          >
            {t("calendar.goToToday")}
          </button>
        )}
      </div>

      <div className={styles.columns}>
        <section className={styles.monthCard}>
          <div className={styles.weekdays} aria-hidden="true">
            {Array.from({ length: DAYS_PER_WEEK }, (_, index) => (
              <span key={index}>{weekdayLetter.format(A_MONDAY + index * MS_PER_DAY)}</span>
            ))}
          </div>
          <div className={styles.grid}>
            {monthCells(view.year, view.month).map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} className={styles.blank} />;
              const key = toDateKey(view.year, view.month, day);
              const workout = workoutByDay.get(key);
              const weight = weightByDay.get(key);
              const measured = measurementsByDay.has(key);
              const label = [
                formatWeekdayDate(key, language),
                workout && `${t("calendar.workoutOption")}: ${workoutName(workout)}`,
                weight && kg(weight.weight),
                measured && t("calendar.measurementsOption"),
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  type="button"
                  key={key}
                  className={[
                    styles.day,
                    key === selected && styles.daySelected,
                    key === today && styles.dayToday,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={label}
                  aria-pressed={key === selected}
                  aria-current={key === today ? "date" : undefined}
                  onClick={() => selectDay(key)}
                >
                  <span className={styles.dayNumber}>{day}</span>
                  <span className={styles.markers} aria-hidden="true">
                    {workout && <span className={`${styles.marker} ${styles.markerWorkout}`} />}
                    {weight && <span className={`${styles.marker} ${styles.markerWeight}`} />}
                    {measured && <span className={`${styles.marker} ${styles.markerMeasured}`} />}
                  </span>
                  {/* Wide screens have room to say what the dots mean for the day. */}
                  {workout && (
                    <span className={styles.note} aria-hidden="true">
                      {workoutName(workout)}
                    </span>
                  )}
                  {weight && (
                    <span className={styles.note} aria-hidden="true">
                      {kg(weight.weight)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.marker} ${styles.markerWorkout}`} />
              {t("calendar.workoutOption")}
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.marker} ${styles.markerWeight}`} />
              {t("calendar.bodyweightOption")}
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.marker} ${styles.markerMeasured}`} />
              {t("calendar.measurementsOption")}
            </span>
          </div>
        </section>

        <section className={styles.dayPanel}>
          <h2 className={styles.dayTitle}>{formatWeekdayDate(selected, language)}</h2>
          <ul className={styles.rows}>
            <li className={styles.row}>
              <span className={`${styles.marker} ${styles.markerWorkout}`} aria-hidden="true" />
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{t("calendar.workoutOption")}</span>
                <span className={styles.rowValue}>
                  {selectedWorkout ? workoutName(selectedWorkout) : t("calendar.noWorkout")}
                </span>
              </span>
              <Link to={`/log?date=${selected}`} className={styles.rowAction}>
                {selectedWorkout ? t("calendar.open") : t("calendar.log")}
              </Link>
            </li>

            <li className={styles.row}>
              <span className={`${styles.marker} ${styles.markerWeight}`} aria-hidden="true" />
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{t("calendar.bodyweightOption")}</span>
                <span className={styles.rowValue}>
                  {selectedWeight ? kg(selectedWeight.weight) : t("calendar.noBodyweight")}
                </span>
              </span>
              {editing !== "bodyweight" && (
                <button type="button" className={styles.rowAction} onClick={editWeight}>
                  {selectedWeight ? t("calendar.edit") : t("calendar.log")}
                </button>
              )}
              {editing === "bodyweight" && (
                <form
                  className={styles.editForm}
                  onKeyDown={cancelOnEscape}
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveWeight();
                  }}
                >
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor={`${fieldId}weight`}>
                      {t("calendar.weightLabel")}
                    </label>
                    <input
                      id={`${fieldId}weight`}
                      className={styles.fieldInput}
                      inputMode="decimal"
                      autoComplete="off"
                      autoFocus
                      value={weightInput}
                      onChange={(event) => setWeightInput(event.target.value)}
                    />
                  </div>
                  <div className={styles.formActions}>
                    <button
                      type="submit"
                      className={styles.saveButton}
                      disabled={!(parseDecimal(weightInput) > 0)}
                    >
                      {t("common.save")}
                    </button>
                    {selectedWeight && (
                      <button type="button" className={styles.textButton} onClick={deleteWeight}>
                        {t("common.delete")}
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => setEditing(null)}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </form>
              )}
            </li>

            <li className={styles.row}>
              <span className={`${styles.marker} ${styles.markerMeasured}`} aria-hidden="true" />
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{t("calendar.measurementsOption")}</span>
                <span className={styles.rowValue}>
                  {selectedMeasurements
                    ? measurementsSummary(selectedMeasurements)
                    : t("calendar.noMeasurements")}
                </span>
              </span>
              {editing !== "measurements" && (
                <button type="button" className={styles.rowAction} onClick={editMeasurements}>
                  {selectedMeasurements ? t("calendar.edit") : t("calendar.log")}
                </button>
              )}
              {editing === "measurements" && (
                <form
                  className={styles.editForm}
                  onKeyDown={cancelOnEscape}
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveMeasurements();
                  }}
                >
                  <div className={styles.measurementGrid}>
                    {MEASUREMENT_FIELDS.map((field, index) => (
                      <div key={field} className={styles.field}>
                        <label className={styles.fieldLabel} htmlFor={`${fieldId}${field}`}>
                          {`${t(`calendar.measurementFields.${field}`)} (cm)`}
                        </label>
                        <input
                          id={`${fieldId}${field}`}
                          className={styles.fieldInput}
                          inputMode="decimal"
                          autoComplete="off"
                          autoFocus={index === 0}
                          value={measurementsForm[field]}
                          onChange={(event) =>
                            setMeasurementsForm((prev) => ({
                              ...prev,
                              [field]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className={styles.formActions}>
                    <button
                      type="submit"
                      className={styles.saveButton}
                      disabled={!hasAnyMeasurement}
                    >
                      {t("common.save")}
                    </button>
                    {selectedMeasurements && (
                      <button
                        type="button"
                        className={styles.textButton}
                        onClick={deleteMeasurements}
                      >
                        {t("common.delete")}
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => setEditing(null)}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </form>
              )}
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export default Calendar;
