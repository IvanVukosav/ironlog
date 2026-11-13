import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import { useSettings } from "../context/useSettings";
import { useReportError } from "../hooks/useReportError";
import { formatNumber } from "../utils/numbers";
import styles from "./TdeeCard.module.css";

const KCAL_PER_KG_BODYWEIGHT = 7700;
const DAYS_PER_WEEK = 7;
const GOAL_ROUNDING_KCAL = 50;
// Weekly bodyweight change (kg) offered as one-click calorie goals.
const GOAL_PRESETS_KG_PER_WEEK = [-0.5, -0.25, 0, 0.25];

function kcalForWeeklyChange(tdee, kgPerWeek) {
  const kcal = tdee + (kgPerWeek * KCAL_PER_KG_BODYWEIGHT) / DAYS_PER_WEEK;
  return Math.round(kcal / GOAL_ROUNDING_KCAL) * GOAL_ROUNDING_KCAL;
}

function weeklyChangeForKcal(tdee, kcal) {
  return ((kcal - tdee) * DAYS_PER_WEEK) / KCAL_PER_KG_BODYWEIGHT;
}

// "+0,25" or "-0,5": a weekly change in kg, signed, in the language's numbers.
function formatSignedKg(kg, language) {
  const rounded = Math.round(kg * 100) / 100;
  return `${rounded > 0 ? "+" : ""}${formatNumber(rounded, language)}`;
}

function TdeeCard({ today }) {
  const { t, i18n } = useTranslation();
  const { showSuccess } = useToast();
  const reportError = useReportError();
  const { settings, updateSettings } = useSettings();
  const kcalGoal = settings?.kcalGoal;
  const [estimate, setEstimate] = useState(null);

  useEffect(() => {
    fetchJson(`/api/stats/tdee?date=${today}`).then(setEstimate).catch(reportError);
  }, [today, reportError]);

  const setGoal = (kcal) => {
    updateSettings({ kcalGoal: kcal }).then((saved) => {
      if (saved) showSuccess(t("tdee.goalSet", { kcal }));
    });
  };

  if (!estimate) return null;

  const language = i18n.language;
  const formatKcal = (kcal) => formatNumber(kcal, language, { maxDecimals: 0 });
  const signedKg = (kg) => formatSignedKg(kg, language);

  if (!estimate.enoughData) {
    return (
      <section className={styles.card}>
        <h2 className={styles.label}>{t("tdee.title")}</h2>
        <p className={styles.detail}>
          {t("tdee.notEnoughData", {
            minIntakeDays: estimate.minIntakeDays,
            minWeighIns: estimate.minWeighIns,
            weeks: estimate.minWeighInSpanDays / DAYS_PER_WEEK,
            intakeDays: estimate.intakeDays,
            weighIns: estimate.weighIns,
          })}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.label}>{t("tdee.title")}</h2>
      <p className={styles.value}>{t("tdee.perDay", { kcal: formatKcal(estimate.tdee) })}</p>
      <p className={styles.detail}>
        {t("tdee.basis", {
          days: estimate.windowDays,
          intake: formatKcal(estimate.averageIntake),
          intakeDays: estimate.intakeDays,
          change: signedKg(estimate.weightChangePerWeek),
          weighIns: estimate.weighIns,
        })}
      </p>
      {kcalGoal > 0 && (
        <p className={styles.detail}>
          {t("tdee.goalProjection", {
            kcal: formatKcal(kcalGoal),
            change: signedKg(weeklyChangeForKcal(estimate.tdee, kcalGoal)),
          })}
        </p>
      )}
      <div className={styles.presets}>
        {GOAL_PRESETS_KG_PER_WEEK.map((kgPerWeek) => {
          const kcal = kcalForWeeklyChange(estimate.tdee, kgPerWeek);
          return (
            <button
              type="button"
              key={kgPerWeek}
              className={styles.preset}
              aria-pressed={kcal === kcalGoal}
              onClick={() => setGoal(kcal)}
            >
              {kgPerWeek === 0
                ? t("tdee.maintenance", { kcal: formatKcal(kcal) })
                : t("tdee.preset", { change: signedKg(kgPerWeek), kcal: formatKcal(kcal) })}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default TdeeCard;
