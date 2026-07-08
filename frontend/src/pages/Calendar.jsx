import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api";
import styles from "./Calendar.module.css";

function Calendar() {
  const navigate = useNavigate();
  const [currentYear, setCurrentYear] = useState(new Date().getUTCFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getUTCMonth() + 1);
  const [workoutDates, setWorkoutDates] = useState([]);

  useEffect(() => {
    fetchJson(
      `/api/workouts/month?year=${currentYear}&month=${currentMonth}`,
    )
      .then((data) => setWorkoutDates(data))
      .catch((err) => console.error(err));
  }, [currentYear, currentMonth]);

  const firstDay = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
  const workoutDayNumbers = workoutDates.map((date) =>
    new Date(date).getUTCDate(),
  );

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else setCurrentMonth(currentMonth + 1);
  };

  const handleDayClick = (day) => {
    if (!day || !workoutDayNumbers.includes(day)) return;
    const dateString = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    navigate(`/log?date=${dateString}`);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Calendar</h1>
      <div className={styles.monthNav}>
        <button className={styles.navButton} onClick={prevMonth}>&lt;</button>
        <span className={styles.monthLabel}>
          {currentYear}-{String(currentMonth).padStart(2, "0")}
        </span>
        <button className={styles.navButton} onClick={nextMonth}>&gt;</button>
      </div>
      <div className={styles.dayGrid}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className={styles.dayHeader}>{day}</div>
        ))}
        {cells.map((day, index) => (
          <div
            key={index}
            className={
              day && workoutDayNumbers.includes(day)
                ? styles.dayCellWorkout
                : styles.dayCell
            }
            onClick={() => handleDayClick(day)}
          >
            {day || ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Calendar;
