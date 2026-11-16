import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RestTimerContext } from "./restTimerContextDefinition";

const MS_PER_SECOND = 1000;
// How often the countdown catches up with the clock.
const TICK_MS = 250;
// A rest that ran out while the app was away gets no beep when it comes back.
const LATE_BEEP_CUTOFF_MS = 5000;
// A rest that ran out stays on screen this long, then goes away by itself.
const OVER_SHOWN_MS = 60 * 1000;

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
 * The rest between sets, for the whole app: a set done in Trening starts it, and its bar shows on
 * every page. It runs off the clock (when the rest ends, not how many ticks have passed), so it
 * stays right after the phone was locked or the app sat in the background, where timers run slow
 * or not at all.
 *
 * `secondsRemaining` is null while no rest is on; `label` names the next set.
 */
export function RestTimerProvider({ children }) {
  const [rest, setRest] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const audioContextRef = useRef(null);

  // Browsers only let a page make sound after a tap, and a rest starts once a set is saved, after
  // the tap is over. So the sound is unlocked by the first tap anywhere, and kept for the beep.
  useEffect(() => {
    const unlock = () => {
      if (!audioContextRef.current) audioContextRef.current = openAudioContext();
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!rest) return undefined;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current - rest.endsAt > OVER_SHOWN_MS) setRest(null);
    };
    const intervalId = setInterval(tick, TICK_MS);
    // Coming back to the app shows the real remaining time at once.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [rest]);

  const secondsRemaining = rest
    ? Math.max(Math.ceil((rest.endsAt - now) / MS_PER_SECOND), 0)
    : null;
  const isOver = secondsRemaining === 0;
  // The rest ran out under our eyes, not while the app was away.
  const beepDue = isOver && now - rest.endsAt < LATE_BEEP_CUTOFF_MS;

  useEffect(() => {
    if (beepDue) playExpiryBeep(audioContextRef.current);
  }, [beepDue]);

  const start = useCallback((seconds, label = null) => {
    if (!(seconds > 0)) return;
    const current = Date.now();
    setNow(current);
    setRest({ endsAt: current + seconds * MS_PER_SECOND, totalSeconds: seconds, label });
  }, []);

  // From a rest that ran out, +15 s starts a new 15 s rest instead of staying at zero.
  const adjust = useCallback((seconds) => {
    const current = Date.now();
    setNow(current);
    setRest((prev) => {
      if (!prev) return prev;
      const endsAt = Math.max(Math.max(prev.endsAt, current) + seconds * MS_PER_SECOND, current);
      const secondsLeft = Math.ceil((endsAt - current) / MS_PER_SECOND);
      return { ...prev, endsAt, totalSeconds: Math.max(prev.totalSeconds, secondsLeft) };
    });
  }, []);

  const skip = useCallback(() => setRest(null), []);

  const value = useMemo(
    () => ({
      secondsRemaining,
      totalSeconds: rest?.totalSeconds ?? 0,
      label: rest?.label ?? null,
      isOver,
      start,
      adjust,
      skip,
    }),
    [secondsRemaining, rest?.totalSeconds, rest?.label, isOver, start, adjust, skip],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}
