import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_E1RM_FORMULA,
  E1RM_FORMULAS,
  estimateFromText,
  MAX_RELIABLE_REPS_TO_FAILURE,
  MAX_RPE,
  MIN_RPE,
} from "../utils/oneRepMax";
import { loadPlateSetup, PLATE_SETUP_STORAGE_KEY } from "../utils/plates";
import { formatNumber, formatPercent, toInputText } from "../utils/numbers";
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
// − and + on a phone: how far a tap moves each field, and where an empty one starts.
const WEIGHT_STEP_KG = 2.5;
const REPS_START = 5;
const RPE_STEP = 0.5;
const RPE_START = 8;

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
  const formulaInfo = E1RM_FORMULAS[formula] ?? E1RM_FORMULAS[DEFAULT_E1RM_FORMULA];
  const estimate = estimateFromText(weight, reps, rpe, formula);
  const e1rm = estimate?.e1rm ?? null;
  const kg = (value) => formatNumber(value, language, { maxDecimals: 1 });

  let detail = t("calculator.formulaNote", { formula: formulaInfo.label });
  if (estimate && e1rm === null) {
    detail = t("calculator.beyondFormula", {
      formula: formulaInfo.label,
      max: formulaInfo.maxReps,
    });
  } else if (estimate?.isRough) {
    detail = t("calculator.roughEstimate", {
      max: MAX_RELIABLE_REPS_TO_FAILURE,
      formula: formulaInfo.label,
    });
  }

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
          <NumberField
            label={t("calculator.weightLabel")}
            value={weight}
            onChange={setWeight}
            step={{
              by: WEIGHT_STEP_KG,
              start: plateSetup.barWeight,
              less: t("log.lessWeightBy", { step: kg(WEIGHT_STEP_KG) }),
              more: t("log.moreWeightBy", { step: kg(WEIGHT_STEP_KG) }),
            }}
          />
          <NumberField
            label={t("calculator.repsLabel")}
            value={reps}
            onChange={setReps}
            inputMode="numeric"
            step={{
              by: 1,
              start: REPS_START,
              min: 1,
              less: t("log.lessReps"),
              more: t("log.moreReps"),
            }}
          />
          <NumberField
            label={t("calculator.rpeLabel")}
            value={rpe}
            onChange={setRpe}
            placeholder="—"
            step={{
              by: RPE_STEP,
              start: RPE_START,
              min: MIN_RPE,
              max: MAX_RPE,
              less: t("log.lessRpeBy", { step: kg(RPE_STEP) }),
              more: t("log.moreRpeBy", { step: kg(RPE_STEP) }),
            }}
          />
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
                {estimate.isRough && "≈ "}
                {kg(e1rm)} <span className={styles.bigUnit}>kg</span>
              </>
            )}
          </p>
          <p className={styles.detail}>{detail}</p>
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
