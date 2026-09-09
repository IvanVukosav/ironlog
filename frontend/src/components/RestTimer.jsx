import { useState, useEffect } from "react";
import styles from "./RestTimer.module.css";

const REST_PRESETS_SECONDS = [60, 90, 120, 180];
const REST_ADJUST_STEP_SECONDS = 15;
const MINIMUM_REST_SECONDS = 0;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function RestTimer() {
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (secondsRemaining === null || secondsRemaining <= 0) return undefined;
    const timeoutId = setTimeout(() => {
      setSecondsRemaining((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [secondsRemaining]);

  const startRest = (duration) => setSecondsRemaining(duration);
  const adjustRest = (amount) =>
    setSecondsRemaining((prev) => Math.max((prev ?? 0) + amount, MINIMUM_REST_SECONDS));
  const resetRest = () => setSecondsRemaining(null);

  return (
    <div className={styles.container}>
      <button
        className={styles.toggleBar}
        onClick={() => setIsMinimized((prev) => !prev)}
      >
        {isMinimized ? "▲" : "▼"}
      </button>
      {!isMinimized && (
        secondsRemaining === null ? (
          <div className={styles.presetRow}>
            {REST_PRESETS_SECONDS.map((duration) => (
              <button
                key={duration}
                className={styles.presetButton}
                onClick={() => startRest(duration)}
              >
                {duration}s
              </button>
            ))}
          </div>
        ) : (
          <div
            className={
              secondsRemaining <= 0
                ? `${styles.timerCard} ${styles.timerExpired}`
                : styles.timerCard
            }
          >
            <span className={styles.time}>{formatTime(secondsRemaining)}</span>
            <div className={styles.controls}>
              <button
                className={styles.adjustButton}
                onClick={() => adjustRest(-REST_ADJUST_STEP_SECONDS)}
              >
                −15s
              </button>
              <button
                className={styles.adjustButton}
                onClick={() => adjustRest(REST_ADJUST_STEP_SECONDS)}
              >
                +15s
              </button>
              <button className={styles.resetButton} onClick={resetRest}>
                ✕
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default RestTimer;
