import { useState, useRef, useEffect } from "react";
import styles from "./DatePicker.module.css";

const MONTH_NAMES = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];
const WEEKDAY_LABELS = ["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"];
const SUNDAY_INDEX = 0;
const DAYS_PER_WEEK = 7;

function formatDateString(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function DatePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = new Date(value);
  const [viewYear, setViewYear] = useState(selectedDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getUTCMonth() + 1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const openPicker = () => {
    const current = new Date(value);
    setViewYear(current.getUTCFullYear());
    setViewMonth(current.getUTCMonth() + 1);
    setIsOpen(true);
  };

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const selectDay = (day) => {
    onChange(formatDateString(viewYear, viewMonth, day));
    setIsOpen(false);
  };

  const firstDayOfWeek = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const leadingBlanks = firstDayOfWeek === SUNDAY_INDEX ? DAYS_PER_WEEK - 1 : firstDayOfWeek - 1;
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day);
  }

  const isSelected = (day) =>
    day !== null &&
    viewYear === selectedDate.getUTCFullYear() &&
    viewMonth === selectedDate.getUTCMonth() + 1 &&
    day === selectedDate.getUTCDate();

  return (
    <div className={styles.container} ref={containerRef}>
      <button type="button" className={styles.trigger} onClick={openPicker}>
        {String(selectedDate.getUTCDate()).padStart(2, "0")}/
        {String(selectedDate.getUTCMonth() + 1).padStart(2, "0")}/
        {selectedDate.getUTCFullYear()}
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <button type="button" className={styles.navButton} onClick={prevMonth}>
              ‹
            </button>
            <span className={styles.monthLabel}>
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
            <button type="button" className={styles.navButton} onClick={nextMonth}>
              ›
            </button>
          </div>
          <div className={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className={styles.weekdayLabel}>
                {label}
              </span>
            ))}
          </div>
          <div className={styles.dayGrid}>
            {cells.map((day, index) => (
              <button
                type="button"
                key={index}
                className={
                  day === null
                    ? styles.dayCellEmpty
                    : isSelected(day)
                      ? styles.dayCellSelected
                      : styles.dayCell
                }
                disabled={day === null}
                onClick={() => day !== null && selectDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
