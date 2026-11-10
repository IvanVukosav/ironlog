import { useTranslation } from "react-i18next";
import { isSameExerciseName } from "../utils/exerciseNames";
import { DEFAULT_E1RM_FORMULA } from "../utils/oneRepMax";
import {
  MAIN_LIFTS,
  SEXES,
  calculateDots,
  calculateWilks,
  findMainLiftBests,
} from "../utils/strengthScores";
import styles from "./PowerliftingSetup.module.css";

const SETTINGS_FIELD_BY_LIFT = {
  squat: "squatExercise",
  bench: "benchExercise",
  deadlift: "deadliftExercise",
};
const DECIMAL_PLACES = 1;

/**
 * Sex and the three lifts behind the powerlifting total, with the numbers they give right
 * underneath. `exerciseSets` is the /api/stats/prs shape; `onChange` saves a settings patch.
 */
function PowerliftingSetup({ settings, exerciseSets, bodyweight, onChange }) {
  const { t } = useTranslation();
  const formula = settings.e1rmFormula ?? DEFAULT_E1RM_FORMULA;
  const sex = settings.sex ?? SEXES.male;
  const bests = findMainLiftBests(exerciseSets, settings, formula);
  // What "Automatic" would pick, so the option can name it.
  const detected = findMainLiftBests(exerciseSets, null, formula);
  const exerciseNames = exerciseSets
    .map((exercise) => exercise.name)
    .sort((nameA, nameB) => nameA.localeCompare(nameB));

  const total = MAIN_LIFTS.every((lift) => bests[lift])
    ? MAIN_LIFTS.reduce((sum, lift) => sum + bests[lift].e1rm, 0)
    : null;
  let summary = t("settings.powerliftingMissingLifts");
  if (total !== null && !bodyweight) {
    summary = t("settings.powerliftingTotalOnly", { total: total.toFixed(DECIMAL_PLACES) });
  } else if (total !== null) {
    summary = t("settings.powerliftingSummary", {
      total: total.toFixed(DECIMAL_PLACES),
      dots: calculateDots(total, bodyweight.weight, sex).toFixed(DECIMAL_PLACES),
      wilks: calculateWilks(total, bodyweight.weight, sex).toFixed(DECIMAL_PLACES),
      bodyweight: bodyweight.weight,
    });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.group}>
        <span className={styles.groupLabel}>{t("settings.sexLabel")}</span>
        <div className={styles.segmented} role="group" aria-label={t("settings.sexLabel")}>
          {Object.values(SEXES).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={sex === option}
              className={
                sex === option ? `${styles.segment} ${styles.segmentActive}` : styles.segment
              }
              onClick={() => onChange({ sex: option })}
            >
              {t(`settings.sexes.${option}`)}
            </button>
          ))}
        </div>
        <p className={styles.hint}>{t("settings.sexHint")}</p>
      </div>

      <div className={styles.group}>
        <span className={styles.groupLabel}>{t("settings.liftsLabel")}</span>
        <p className={styles.hint}>{t("settings.liftsHint")}</p>
        {MAIN_LIFTS.map((lift) => {
          const field = SETTINGS_FIELD_BY_LIFT[lift];
          const chosen = settings[field] ?? "";
          // Select the logged spelling of the pick; a pick without any sets stays listed as such.
          const loggedName =
            chosen && exerciseNames.find((name) => isSameExerciseName(name, chosen));
          return (
            <label key={lift} className={styles.liftRow}>
              <span className={styles.liftName}>{t(`stats.lifts.${lift}`)}</span>
              <select
                className={styles.liftSelect}
                value={loggedName || chosen}
                onChange={(event) => onChange({ [field]: event.target.value || null })}
              >
                <option value="">
                  {detected[lift]
                    ? t("settings.liftAutoDetected", { name: detected[lift].name })
                    : t("settings.liftAutoNone")}
                </option>
                {chosen && !loggedName && (
                  <option value={chosen}>{t("settings.liftNoData", { name: chosen })}</option>
                )}
                {exerciseNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <span className={styles.liftValue}>
                {bests[lift] ? `${bests[lift].e1rm.toFixed(DECIMAL_PLACES)} kg` : "—"}
              </span>
            </label>
          );
        })}
      </div>

      <p className={styles.summary}>{summary}</p>
    </div>
  );
}

export default PowerliftingSetup;
