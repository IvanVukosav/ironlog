import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api";
import styles from "./Calendar.module.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function Calendar() {
  const navigate = useNavigate();
  const [currentYear, setCurrentYear] = useState(new Date().getUTCFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getUTCMonth() + 1);
  const [workoutDates, setWorkoutDates] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [bwModalDate, setBwModalDate] = useState(null);
  const [bwWeight, setBwWeight] = useState("");
  const dropdownRef = useRef(null);

  const today = new Date();
  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth() + 1;
  const todayDay = today.getUTCDate();

  useEffect(() => {
    fetchJson(`/api/workouts/month?year=${currentYear}&month=${currentMonth}`)
      .then((data) => setWorkoutDates(data))
      .catch((err) => console.error(err));
  }, [currentYear, currentMonth]);

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
  const workoutDayNumbers = workoutDates.map((date) => new Date(date).getUTCDate());

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
    setBwWeight("");
  };

  const saveBw = () => {
    const parsed = parseFloat(bwWeight);
    if (!bwWeight || isNaN(parsed) || parsed <= 0) return;
    fetchJson("/api/bodyweight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: bwModalDate, weight: parsed }),
    })
      .then(() => setBwModalDate(null))
      .catch((err) => console.error(err));
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <div className={styles.page}>
      <div className={styles.monthNav}>
        <button className={styles.navButton} onClick={prevMonth}>&lt;</button>
        <h1 className={styles.monthHeading}>
          {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </h1>
        <button className={styles.navButton} onClick={nextMonth}>&gt;</button>
      </div>

      <div className={styles.calendarGrid}>
        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
          <div key={day} className={styles.dayHeader}>{day}</div>
        ))}
        {cells.map((day, index) => (
          <div
            key={index}
            className={[
              styles.dayCell,
              !day ? styles.dayCellEmpty : "",
              day && isToday(day) ? styles.dayCellToday : "",
            ].filter(Boolean).join(" ")}
            onClick={() => handleDayClick(day)}
          >
            {day && (
              <>
                <span className={styles.dayNumber}>{day}</span>
                {workoutDayNumbers.includes(day) && (
                  <span className={styles.workoutDot} />
                )}
                {activeDropdown === day && (
                  <div className={styles.dropdown} ref={dropdownRef}>
                    <button
                      className={styles.dropdownItem}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleWorkoutClick(day);
                      }}
                    >
                      Workout
                    </button>
                    <button
                      className={styles.dropdownItem}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleBwClick(day);
                      }}
                    >
                      Bodyweight
                    </button>
                  </div>
                )}
              </>
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
                Bodyweight {bwModalDate}
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
            <button className={styles.bwSaveButton} onClick={saveBw}>
              Spremi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;
