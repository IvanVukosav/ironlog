import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { calculateOneRepMax, ONE_REP_MAX_FORMULAS } from "../utils/oneRepMax";
import { BAR_WEIGHTS_KG, DEFAULT_PLATE_SETUP, STANDARD_PLATES_KG } from "../utils/plates";
import { useToast } from "../context/useToast";
import PlateCalculator from "../components/PlateCalculator";
import styles from "./Calculator.module.css";

const BRZYCKI_MAX_REPS = 37;
const MIN_PERCENTAGE = 0;
const MAX_PERCENTAGE = 100;
const MIN_STEP = 1;
const RESULT_DECIMAL_PLACES = 2;
const PLATE_SETUP_STORAGE_KEY = "ironlog-plate-setup";

function loadPlateSetup() {
  try {
    const stored = JSON.parse(localStorage.getItem(PLATE_SETUP_STORAGE_KEY));
    if (!stored) return DEFAULT_PLATE_SETUP;
    return {
      barWeight: BAR_WEIGHTS_KG.includes(stored.barWeight) ? stored.barWeight : DEFAULT_PLATE_SETUP.barWeight,
      useCollars: Boolean(stored.useCollars),
      availablePlates: Array.isArray(stored.availablePlates)
        ? stored.availablePlates.filter((plate) => STANDARD_PLATES_KG.includes(plate))
        : DEFAULT_PLATE_SETUP.availablePlates,
    };
  } catch {
    return DEFAULT_PLATE_SETUP;
  }
}

function Calculator() {
  const { t } = useTranslation();
  const { showError } = useToast();
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);
  const [step, setStep] = useState(5);
  const [minPct, setMinPct] = useState(70);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);
  const [plateTarget, setPlateTarget] = useState("");
  const [plateSetup, setPlateSetup] = useState(loadPlateSetup);
  const plateSectionRef = useRef(null);
  const formula = settings?.e1rmFormula ?? ONE_REP_MAX_FORMULAS.brzycki;

  const changePlateSetup = (nextSetup) => {
    setPlateSetup(nextSetup);
    try {
      localStorage.setItem(PLATE_SETUP_STORAGE_KEY, JSON.stringify(nextSetup));
    } catch {
      // Storage unavailable: the setup just resets on reload.
    }
  };

  const loadIntoPlateCalculator = (weightKg) => {
    setPlateTarget(String(weightKg));
    plateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [showError]);

  const calculate = () => {
    if (!weight || !reps) return;

    if (weight <= 0 || reps <= 0) {
      setError(t("calculator.errorWeightRepsPositive"));
      return;
    }
    if (step < MIN_STEP) {
      setError(t("calculator.errorStepMin", { min: MIN_STEP }));
      return;
    }
    if (minPct < MIN_PERCENTAGE || minPct > MAX_PERCENTAGE) {
      setError(t("calculator.errorPercentageRange", { min: MIN_PERCENTAGE, max: MAX_PERCENTAGE }));
      return;
    }
    if (formula === ONE_REP_MAX_FORMULAS.brzycki && reps >= BRZYCKI_MAX_REPS) {
      setError(t("calculator.errorBrzyckiMaxReps"));
      return;
    }
    setError(null);

    const result = calculateOneRepMax(parseFloat(weight), parseFloat(reps), formula);
    setOneRM(parseFloat(result.toFixed(RESULT_DECIMAL_PLACES)));
  };

  const percentages = [];
  for (let pct = 100; pct >= minPct; pct -= step) {
    percentages.push(pct);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("nav.calculator")}</h1>

      <div className={styles.inputRow}>
        <input
          type="number"
          min="0"
          className={styles.input}
          placeholder={t("calculator.weightPlaceholder")}
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
        />
        <input
          type="number"
          min="0"
          className={styles.input}
          placeholder={t("calculator.repsPlaceholder")}
          value={reps}
          onChange={(event) => setReps(event.target.value)}
        />
        <button
          className={styles.calculateButton}
          onClick={calculate}
          disabled={!weight || !reps}
        >
          {t("calculator.calculate")}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {oneRM && <p className={styles.result}>e1RM: {oneRM} kg</p>}

      <div className={styles.optionsRow}>
        <input
          type="number"
          min={MIN_STEP}
          className={styles.input}
          placeholder={t("calculator.stepPlaceholder")}
          value={step}
          onChange={(event) => setStep(parseFloat(event.target.value))}
        />
        <input
          type="number"
          min={MIN_PERCENTAGE}
          max={MAX_PERCENTAGE}
          className={styles.input}
          placeholder={t("calculator.minPercentagePlaceholder")}
          value={minPct}
          onChange={(event) => setMinPct(parseFloat(event.target.value))}
        />
      </div>

      {oneRM && (
        <table className={styles.table}>
          <tbody>
            {percentages.map((pct) => (
              <tr
                key={pct}
                className={styles.clickableRow}
                title={t("calculator.loadIntoPlates")}
                onClick={() => loadIntoPlateCalculator(((oneRM * pct) / 100).toFixed(2))}
              >
                <td>{pct}%</td>
                <td>{((oneRM * pct) / 100).toFixed(2)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section ref={plateSectionRef} className={styles.section}>
        <h2 className={styles.sectionHeading}>{t("calculator.platesHeading")}</h2>
        <PlateCalculator
          target={plateTarget}
          onTargetChange={setPlateTarget}
          setup={plateSetup}
          onSetupChange={changePlateSetup}
        />
      </section>
    </div>
  );
}

export default Calculator;
