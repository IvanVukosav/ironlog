import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import styles from "./Calendar.module.css";

const EMPTY_MEASUREMENTS = { waist: "", chest: "", arms: "", thighs: "", hips: "" };
const MEASUREMENT_FIELDS = ["waist", "chest", "arms", "thighs", "hips"];

function Calendar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showError } = useToast();
  const [currentYear, setCurrentYear] = useState(new Date().getUTCFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getUTCMonth() + 1);
  const [workoutDates, setWorkoutDates] = useState([]);
  const [monthBwEntries, setMonthBwEntries] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [bwModalDate, setBwModalDate] = useState(null);
  const [bwWeight, setBwWeight] = useState("");
  const [bwEntryId, setBwEntryId] = useState(null);
  const [monthMeasurements, setMonthMeasurements] = useState([]);
  const [measurementsModalDate, setMeasurementsModalDate] = useState(null);
  const [measurementsForm, setMeasurementsForm] = useState(EMPTY_MEASUREMENTS);
  const [measurementsEntryId, setMeasurementsEntryId] = useState(null);
  const dropdownRef = useRef(null);

  const today = new Date();
  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth() + 1;
  const todayDay = today.getUTCDate();

  useEffect(() => {
    setWorkoutDates([]);
    setMonthBwEntries([]);

    fetchJson(`/api/workouts/month?year=${currentYear}&month=${currentMonth}`)
      .then((data) => setWorkoutDates(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson(`/api/bodyweight?year=${currentYear}&month=${currentMonth}`)
      .then((data) => setMonthBwEntries(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson(`/api/body-measurements?year=${currentYear}&month=${currentMonth}`)
      .then((data) => setMonthMeasurements(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [currentYear, currentMonth, showError]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const firstDay = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
  const matchesCurrentMonthDay = (dateString, day) => {
    const date = new Date(dateString);
    return (
      date.getUTCFullYear() === currentYear &&
      date.getUTCMonth() + 1 === currentMonth &&
      date.getUTCDate() === day
    );
  };

  const workoutDayNumbers = workoutDates
    .filter((entry) => {
      const date = new Date(entry.date);
      return date.getUTCFullYear() === currentYear && date.getUTCMonth() + 1 === currentMonth;
    })
    .map((entry) => new Date(entry.date).getUTCDate());

  const getWorkoutName = (day) => {
    const entry = workoutDates.find((workoutEntry) => matchesCurrentMonthDay(workoutEntry.date, day));
    return entry ? entry.name : null;
  };

  const getBwEntry = (day) => {
    return monthBwEntries.find((bwEntry) => matchesCurrentMonthDay(bwEntry.date, day)) || null;
  };

  const getBwWeight = (day) => {
    const entry = getBwEntry(day);
    return entry ? entry.weight : null;
  };

  const getMeasurementsEntry = (day) => {
    return monthMeasurements.find((entry) => matchesCurrentMonthDay(entry.date, day)) || null;
  };

  const isToday = (day) =>
    day !== null &&
    currentYear === todayYear &&
    currentMonth === todayMonth &&
    day === todayDay;

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (day) => {
    if (!day) return;
    setActiveDropdown(activeDropdown === day ? null : day);
  };

  const handleWorkoutClick = (day) => {
    const dateString = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setActiveDropdown(null);
    navigate(`/log?date=${dateString}`);
  };

  const handleBwClick = (day) => {
    const dateString = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setActiveDropdown(null);
    setBwModalDate(dateString);
    const existingEntry = getBwEntry(day);
    setBwWeight(existingEntry ? String(existingEntry.weight) : "");
    setBwEntryId(existingEntry ? existingEntry.id : null);
  };

  const saveBw = () => {
    const parsed = parseFloat(bwWeight);
    if (!bwWeight || isNaN(parsed) || parsed <= 0) return;
    fetchJson("/api/bodyweight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: bwModalDate, weight: parsed }),
    })
      .then((data) => {
        setBwModalDate(null);
        setMonthBwEntries((prev) => {
          const savedDate = new Date(data.date);
          const filtered = prev.filter((entry) => {
            const entryDate = new Date(entry.date);
            return !(
              entryDate.getUTCFullYear() === savedDate.getUTCFullYear() &&
              entryDate.getUTCMonth() === savedDate.getUTCMonth() &&
              entryDate.getUTCDate() === savedDate.getUTCDate()
            );
          });
          return [...filtered, data];
        });
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const deleteBw = () => {
    if (bwEntryId === null) return;
    fetchJson(`/api/bodyweight/${bwEntryId}`, { method: "DELETE" })
      .then(() => {
        setBwModalDate(null);
        setMonthBwEntries((prev) => prev.filter((entry) => entry.id !== bwEntryId));
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const handleMeasurementsClick = (day) => {
    const dateString = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setActiveDropdown(null);
    setMeasurementsModalDate(dateString);
    const existingEntry = getMeasurementsEntry(day);
    setMeasurementsForm(
      existingEntry
        ? {
            waist: existingEntry.waist ?? "",
            chest: existingEntry.chest ?? "",
            arms: existingEntry.arms ?? "",
            thighs: existingEntry.thighs ?? "",
            hips: existingEntry.hips ?? "",
          }
        : EMPTY_MEASUREMENTS,
    );
    setMeasurementsEntryId(existingEntry ? existingEntry.id : null);
  };

  const saveMeasurements = () => {
    const hasAnyValue = MEASUREMENT_FIELDS.some((field) => measurementsForm[field] !== "");
    if (!hasAnyValue) return;
    fetchJson("/api/body-measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: measurementsModalDate, ...measurementsForm }),
    })
      .then((data) => {
        setMeasurementsModalDate(null);
        setMonthMeasurements((prev) => {
          const savedDate = new Date(data.date);
          const filtered = prev.filter((entry) => {
            const entryDate = new Date(entry.date);
            return !(
              entryDate.getUTCFullYear() === savedDate.getUTCFullYear() &&
              entryDate.getUTCMonth() === savedDate.getUTCMonth() &&
              entryDate.getUTCDate() === savedDate.getUTCDate()
            );
          });
          return [...filtered, data];
        });
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const deleteMeasurements = () => {
    if (measurementsEntryId === null) return;
    fetchJson(`/api/body-measurements/${measurementsEntryId}`, { method: "DELETE" })
      .then(() => {
        setMeasurementsModalDate(null);
        setMonthMeasurements((prev) => prev.filter((entry) => entry.id !== measurementsEntryId));
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const prevMonthDays = new Date(Date.UTC(currentYear, currentMonth - 1, 0)).getUTCDate();
  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, overflow: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, overflow: false });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, overflow: true });
  }

  return (
    <div className={styles.page}>
      <div className={styles.monthNav}>
        <button className={styles.navButton} onClick={prevMonth}>&lt;</button>
        <h1 className={styles.monthHeading}>
          {t("common.months", { returnObjects: true })[currentMonth - 1]} {currentYear}
        </h1>
        <button className={styles.navButton} onClick={nextMonth}>&gt;</button>
      </div>

      <div className={styles.calendarGrid}>
        {t("calendar.weekdays", { returnObjects: true }).map((day) => (
          <div key={day} className={styles.dayHeader}>{day}</div>
        ))}
        {cells.map((cell, index) => (
          <div
            key={index}
            className={[
              styles.dayCell,
              cell.overflow ? styles.dayCellOverflow : "",
              !cell.overflow && isToday(cell.day) ? styles.dayCellToday : "",
            ].filter(Boolean).join(" ")}
            onClick={() => !cell.overflow && handleDayClick(cell.day)}
          >
            <span className={cell.overflow ? styles.dayNumberOverflow : styles.dayNumber}>
              {cell.day}
            </span>
            {!cell.overflow && workoutDayNumbers.includes(cell.day) && (
              <div className={styles.cellWorkout}>
                <span>🏋</span>
                {getWorkoutName(cell.day) && (
                  <span className={styles.cellWorkoutName}>{getWorkoutName(cell.day)}</span>
                )}
              </div>
            )}
            {!cell.overflow && getBwWeight(cell.day) !== null && (
              <div className={styles.cellBw}>
                <span>⚖</span>
                <span className={styles.cellBwWeight}>{getBwWeight(cell.day)} kg</span>
              </div>
            )}
            {!cell.overflow && activeDropdown === cell.day && (
              <div className={styles.dropdown} ref={dropdownRef}>
                <button
                  className={styles.dropdownItem}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleWorkoutClick(cell.day);
                  }}
                >
                  {t("calendar.workoutOption")}
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleBwClick(cell.day);
                  }}
                >
                  {t("calendar.bodyweightOption")}
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleMeasurementsClick(cell.day);
                  }}
                >
                  {t("calendar.measurementsOption")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {bwModalDate && (
        <div className={styles.bwOverlay} onClick={() => setBwModalDate(null)}>
          <div
            className={styles.bwModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.bwModalHeader}>
              <span className={styles.bwModalTitle}>
                {t("calendar.bodyweightModalTitle", { date: bwModalDate })}
              </span>
              <button
                className={styles.bwModalClose}
                onClick={() => setBwModalDate(null)}
              >
                X
              </button>
            </div>
            <input
              className={styles.bwInput}
              type="number"
              placeholder="kg"
              autoFocus
              value={bwWeight}
              onChange={(event) => setBwWeight(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveBw();
                if (event.key === "Escape") setBwModalDate(null);
              }}
            />
            <div className={styles.bwModalFooter}>
              {bwEntryId !== null && (
                <button className={styles.bwDeleteButton} onClick={deleteBw}>
                  {t("common.delete")}
                </button>
              )}
              <button className={styles.bwSaveButton} onClick={saveBw}>
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {measurementsModalDate && (
        <div className={styles.bwOverlay} onClick={() => setMeasurementsModalDate(null)}>
          <div
            className={styles.bwModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.bwModalHeader}>
              <span className={styles.bwModalTitle}>
                {t("calendar.measurementsModalTitle", { date: measurementsModalDate })}
              </span>
              <button
                className={styles.bwModalClose}
                onClick={() => setMeasurementsModalDate(null)}
              >
                X
              </button>
            </div>
            <div className={styles.measurementsGrid}>
              {MEASUREMENT_FIELDS.map((field) => (
                <div key={field} className={styles.measurementField}>
                  <label className={styles.measurementLabel}>
                    {t(`calendar.measurementFields.${field}`)}
                  </label>
                  <input
                    className={styles.measurementInput}
                    type="number"
                    placeholder="cm"
                    value={measurementsForm[field]}
                    onChange={(event) =>
                      setMeasurementsForm((prev) => ({ ...prev, [field]: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveMeasurements();
                      if (event.key === "Escape") setMeasurementsModalDate(null);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className={styles.bwModalFooter}>
              {measurementsEntryId !== null && (
                <button className={styles.bwDeleteButton} onClick={deleteMeasurements}>
                  {t("common.delete")}
                </button>
              )}
              <button className={styles.bwSaveButton} onClick={saveMeasurements}>
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;
