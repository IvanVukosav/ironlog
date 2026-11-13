import { useTranslation } from "react-i18next";
import { formatShortDate, todayKey } from "../utils/dates";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A function that names a stored day the way people say it: "danas", "jučer", or "28. lis".
 * Days are UTC midnights; today is the user's own today.
 */
export function useDayLabel() {
  const { t, i18n } = useTranslation();
  const todayStart = Date.parse(todayKey());
  return (date) => {
    const daysAgo = Math.round((todayStart - new Date(date).getTime()) / DAY_MS);
    if (daysAgo === 0) return t("common.today");
    if (daysAgo === 1) return t("common.yesterday");
    return formatShortDate(date, i18n.language);
  };
}
