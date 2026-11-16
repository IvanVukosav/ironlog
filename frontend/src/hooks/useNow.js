import { useEffect, useState } from "react";

const MS_PER_SECOND = 1000;

// The time now, in ms, kept up to date every second while `isRunning`.
export function useNow(isRunning) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) return undefined;
    const intervalId = setInterval(() => setNow(Date.now()), MS_PER_SECOND);
    return () => clearInterval(intervalId);
  }, [isRunning]);

  return now;
}
