import { useState, useEffect, useRef } from "react";
import styles from "./RestTimer.module.css";

const REST_PRESETS_SECONDS = [60, 90, 120, 180];
const REST_ADJUST_STEP_SECONDS = 15;
const MS_PER_SECOND = 1000;
// How often the display catches up with the clock.
const TICK_MS = 250;
// A rest that ran out while the app was away gets no beep when it comes back.
const LATE_BEEP_CUTOFF_MS = 5000;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Browsers only let a page make sound after a tap, so the context is opened when a preset is
// tapped and kept for the beep at the end.
function openAudioContext() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    audioContext.resume().catch((err) => console.error(err));
    return audioContext;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function playExpiryBeep(audioContext) {
  if (!audioContext) return;
  const beep = () => {
    [0, 0.2].forEach((startOffset) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      const startTime = audioContext.currentTime + startOffset;
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.15);
    });
  };
  const ready = audioContext.state === "suspended" ? audioContext.resume() : Promise.resolve();
  ready.then(beep).catch((err) => console.error(err));
}

/**
 * The rest countdown. It runs off the clock (when the rest ends, not how many ticks have passed),
 * so it stays right after the phone was locked or the app sat in the background, where timers
 * run slow or not at all. `secondsRemaining` is null while no rest is running.
 */
function useRestTimer() {
  const [endsAt, setEndsAt] = useState(null);
  const [now, setNow] = useState(0);
  const audioContextRef = useRef(null);

  useEffect(() => {
    if (endsAt === null) return undefined;
    const tick = () => setNow(Date.now());
    const intervalId = setInterval(() => {
      tick();
      if (Date.now() >= endsAt) clearInterval(intervalId);
    }, TICK_MS);
    // Coming back to the app shows the real remaining time at once.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [endsAt]);

  const secondsRemaining =
    endsAt === null ? null : Math.max(Math.ceil((endsAt - now) / MS_PER_SECOND), 0);
  // The rest ran out under our eyes, not while the app was away.
  const beepDue = secondsRemaining === 0 && now - endsAt < LATE_BEEP_CUTOFF_MS;

  useEffect(() => {
    if (beepDue) playExpiryBeep(audioContextRef.current);
  }, [beepDue]);

  const start = (seconds) => {
    if (!audioContextRef.current) audioContextRef.current = openAudioContext();
    const current = Date.now();
    setNow(current);
    setEndsAt(current + seconds * MS_PER_SECOND);
  };
  // From a rest that ran out, +15 s starts a new 15 s rest instead of staying at zero.
  const adjust = (seconds) => {
    const current = Date.now();
    setNow(current);
    setEndsAt((prev) => Math.max(Math.max(prev, current) + seconds * MS_PER_SECOND, current));
  };
  const reset = () => setEndsAt(null);

  return { secondsRemaining, start, adjust, reset };
}

function RestTimer() {
  const { secondsRemaining, start, adjust, reset } = useRestTimer();
  const [isMinimized, setIsMinimized] = useState(true);

  return (
    <div className={styles.container}>
      <button className={styles.toggleBar} onClick={() => setIsMinimized((prev) => !prev)}>
        {isMinimized ? "▲" : "▼"}
      </button>
      {!isMinimized &&
        (secondsRemaining === null ? (
          <div className={styles.presetRow}>
            {REST_PRESETS_SECONDS.map((duration) => (
              <button
                key={duration}
                className={styles.presetButton}
                onClick={() => start(duration)}
              >
                {duration}s
              </button>
            ))}
          </div>
        ) : (
          <div
            className={
              secondsRemaining === 0
                ? `${styles.timerCard} ${styles.timerExpired}`
                : styles.timerCard
            }
          >
            <span className={styles.time}>{formatTime(secondsRemaining)}</span>
            <div className={styles.controls}>
              <button
                className={styles.adjustButton}
                onClick={() => adjust(-REST_ADJUST_STEP_SECONDS)}
              >
                −15s
              </button>
              <button
                className={styles.adjustButton}
                onClick={() => adjust(REST_ADJUST_STEP_SECONDS)}
              >
                +15s
              </button>
              <button className={styles.resetButton} onClick={reset}>
                ✕
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

export default RestTimer;
