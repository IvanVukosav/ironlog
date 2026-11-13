import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  calculateEstimatedOneRepMax,
  DEFAULT_E1RM_FORMULA,
  E1RM_FORMULAS,
  MAX_E1RM_REPS_TO_FAILURE,
} from "../utils/oneRepMax";
import { BAR_WEIGHTS_KG, DEFAULT_PLATE_SETUP, STANDARD_PLATES_KG } from "../utils/plates";
import { formatNumber, formatPercent, parseDecimal, toInputText } from "../utils/numbers";
import { useSettings } from "../context/useSettings";
import LoadList from "../components/LoadList";
import NumberField from "../components/NumberField";
import PlateCalculator from "../components/PlateCalculator";
import SegmentedControl from "../components/SegmentedControl";
import WarmupGenerator from "../components/WarmupGenerator";
import styles from "./Calculator.module.css";

const PERCENT_STEPS = [2.5, 5, 10];
const PERCENT_FLOORS = [50, 60, 70];
const DEFAULT_PERCENT_STEP = 5;
const DEFAULT_PERCENT_FLOOR = 70;
const MIN_RPE = 1;
const MAX_RPE = 10;
const PLATE_SETUP_STORAGE_KEY = "ironlog-plate-setup";

function loadPlateSetup() {
  try {
    const stored = JSON.parse(localStorage.getItem(PLATE_SETUP_STORAGE_KEY));
    if (!stored) return DEFAULT_PLATE_SETUP;
    return {
      barWeight: BAR_WEIGHTS_KG.includes(stored.barWeight)
        ? stored.barWeight
        : DEFAULT_PLATE_SETUP.barWeight,
      useCollars: Boolean(stored.useCollars),
      availablePlates: Array.isArray(stored.availablePlates)
        ? stored.availablePlates.filter((plate) => STANDARD_PLATES_KG.includes(plate))
        : DEFAULT_PLATE_SETUP.availablePlates,
    };
  } catch {
    return DEFAULT_PLATE_SETUP;
  }
}

// The e1RM for what was typed, worked out the way a set in Trening gets its own: the RPE adds the
// reps left in reserve, and past MAX_E1RM_REPS_TO_FAILURE reps to failure there is none (e1rm
// null). Null until there is a weight, a whole number of reps, and an RPE from 1 to 10 or none.
function estimateFromText(weightText, repsText, rpeText, formula) {
  const weight = parseDecimal(weightText);
  const reps = parseDecimal(repsText);
  const rpe = rpeText.trim() === "" ? null : parseDecimal(rpeText);
  if (!(weight > 0) || !Number.isInteger(reps) || reps < 1) return null;
  if (rpe !== null && !(rpe >= MIN_RPE && rpe <= MAX_RPE)) return null;
  return { e1rm: calculateEstimatedOneRepMax(weight, reps, rpe, formula) };
}

// 100 % down to the floor, a step at a time.
const percentagesDownTo = (floor, step) =>
  Array.from({ length: Math.floor((100 - floor) / step) + 1 }, (_, index) => 100 - index * step);

function Calculator() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { settings } = useSettings();
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [percentStep, setPercentStep] = useState(DEFAULT_PERCENT_STEP);
  const [percentFloor, setPercentFloor] = useState(DEFAULT_PERCENT_FLOOR);
  const [plateTarget, setPlateTarget] = useState("");
  const [plateSetup, setPlateSetup] = useState(loadPlateSetup);
  const plateSectionRef = useRef(null);
  const formula = settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA;
  const formulaLabel = (E1RM_FORMULAS[formula] ?? E1RM_FORMULAS[DEFAULT_E1RM_FORMULA]).label;
  const estimate = estimateFromText(weight, reps, rpe, formula);
  const e1rm = estimate?.e1rm ?? null;
  const kg = (value) => formatNumber(value, language, { maxDecimals: 1 });

  const changePlateSetup = (nextSetup) => {
    setPlateSetup(nextSetup);
    try {
      localStorage.setItem(PLATE_SETUP_STORAGE_KEY, JSON.stringify(nextSetup));
    } catch {
      // Storage unavailable: the setup just resets on reload.
    }
  };

  // A weight from a list goes into the plate calculator, as the list shows it (to 0.1 kg).
  const loadIntoPlateCalculator = (weightKg) => {
    setPlateTarget(toInputText(Math.round(weightKg * 10) / 10, language));
    plateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const percentRows =
    e1rm === null
      ? []
      : percentagesDownTo(percentFloor, percentStep).map((percent) => {
          const percentWeight = (e1rm * percent) / 100;
          return {
            key: percent,
            label: formatPercent(percent, language),
            value: `${kg(percentWeight)} kg`,
            weight: percentWeight,
          };
        });

  const percentOptions = (values) =>
    values.map((value) => ({ value, label: formatPercent(value, language) }));

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("nav.calculator")}</h1>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("calculator.oneRepMaxTitle")}</h2>
        <div className={styles.fields}>
          <NumberField label={t("calculator.weightLabel")} value={weight} onChange={setWeight} />
          <NumberField
            label={t("calculator.repsLabel")}
            value={reps}
            onChange={setReps}
            inputMode="numeric"
          />
          <NumberField label={t("calculator.rpeLabel")} value={rpe} onChange={setRpe} />
        </div>
        <div className={styles.result} aria-live="polite">
          <p
            className={
              e1rm === null ? `${styles.bigNumber} ${styles.bigNumberEmpty}` : styles.bigNumber
            }
          >
            {e1rm === null ? (
              "—"
            ) : (
              <>
                {kg(e1rm)} <span className={styles.bigUnit}>kg</span>
              </>
            )}
          </p>
          <p className={styles.detail}>
            {estimate && e1rm === null
              ? t("calculator.tooManyReps", { max: MAX_E1RM_REPS_TO_FAILURE })
              : t("calculator.formulaNote", { formula: formulaLabel })}
          </p>
        </div>
      </section>

      {e1rm !== null && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t("calculator.percentagesTitle")}</h2>
          <div className={styles.controls}>
            <div className={styles.control}>
              <span className={styles.controlLabel} aria-hidden="true">
                {t("calculator.step")}
              </span>
              <SegmentedControl
                compact
                label={t("calculator.step")}
                options={percentOptions(PERCENT_STEPS)}
                value={percentStep}
                onChange={setPercentStep}
              />
            </div>
            <div className={styles.control}>
              <span className={styles.controlLabel} aria-hidden="true">
                {t("calculator.downTo")}
              </span>
              <SegmentedControl
                compact
                label={t("calculator.downTo")}
                options={percentOptions(PERCENT_FLOORS)}
                value={percentFloor}
                onChange={setPercentFloor}
              />
            </div>
          </div>
          <LoadList
            rows={percentRows}
            action={t("calculator.loadIntoPlates")}
            onSelect={loadIntoPlateCalculator}
          />
        </section>
      )}

      <section ref={plateSectionRef} className={styles.card}>
        <h2 className={styles.cardTitle}>{t("calculator.platesHeading")}</h2>
        <PlateCalculator
          target={plateTarget}
          onTargetChange={setPlateTarget}
          setup={plateSetup}
          onSetupChange={changePlateSetup}
        />
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("calculator.warmupHeading")}</h2>
        <WarmupGenerator setup={plateSetup} onSelectWeight={loadIntoPlateCalculator} />
      </section>
    </div>
  );
}

export default Calculator;
