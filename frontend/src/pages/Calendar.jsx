import { useState, useEffect } from "react";

function Calendar() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [workoutDates, setWorkoutDates] = useState([]);

  useEffect(() => {
    fetch(
      `http://localhost:3001/api/workouts/month?year=${currentYear}&month=${currentMonth}`,
    )
      .then((res) => res.json())
      .then((data) => setWorkoutDates(data));
  }, [currentYear, currentMonth]);

  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
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

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <div className="page">
      <h1>Calendar</h1>
      <div>
        <button onClick={prevMonth}>&lt;</button>
        <span>
          {" "}
          {currentYear}-{String(currentMonth).padStart(2, "0")}{" "}
        </span>
        <button onClick={nextMonth}>&gt;</button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          marginTop: "16px",
        }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day}>
            <strong>{day}</strong>
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            style={{
              background:
                day && workoutDayNumbers.includes(day)
                  ? "green"
                  : "transparent",
            }}>
            {day || ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Calendar;
