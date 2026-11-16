import { useSearchParams } from "react-router-dom";
import { isDateKey, todayKey } from "../utils/dates";

/**
 * The page's day, kept in the address as ?date=2026-11-16 (today goes without it): the back
 * button returns to the day shown before, and a link or a reload opens the same day. An address
 * with no day, or a day that doesn't exist, shows today.
 */
export function useDateParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayKey();
  const param = searchParams.get("date");
  const date = isDateKey(param) ? param : today;

  const setDate = (next) => {
    if (next === date) return;
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next === today) params.delete("date");
      else params.set("date", next);
      return params;
    });
  };

  return [date, setDate];
}
