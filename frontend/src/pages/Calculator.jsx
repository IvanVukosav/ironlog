import { useState } from "react";
import styles from "./Calculator.module.css";

const BRZYCKI_A = 1.0278;
const BRZYCKI_B = 0.0278;
const BRZYCKI_MAX_REPS = 37;
const MIN_PERCENTAGE = 0;
const MAX_PERCENTAGE = 100;
const MIN_STEP = 1;

function Calculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);
  const [step, setStep] = useState(5);
  const [minPct, setMinPct] = useState(70);
  const [error, setError] = useState(null);

  const calculate = () => {
    if (!weight || !reps) return;

    if (weight <= 0 || reps <= 0) {
      setError("Weight and reps must be greater than 0");
      return;
    }
    if (step < MIN_STEP) {
      setError(`Step must be at least ${MIN_STEP}`);
      return;
    }
    if (minPct < MIN_PERCENTAGE || minPct > MAX_PERCENTAGE) {
      setError(`Percentage must be between ${MIN_PERCENTAGE} and ${MAX_PERCENTAGE}`);
      return;
    }
    if (reps >= BRZYCKI_MAX_REPS) {
      setError("Brzycki formula does not work for 37+ reps");
      return;
    }
    setError(null);

    const result = weight / (BRZYCKI_A - BRZYCKI_B * reps);
    setOneRM(parseFloat(result.toFixed(2)));
  };

  const percentages = [];
  for (let pct = 100; pct >= minPct; pct -= step) {
    percentages.push(pct);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Calculator</h1>

      <div className={styles.inputRow}>
        <input
          type="number"
          min="0"
          className={styles.input}
          placeholder="Daj kilazicu"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
        />
        <input
          type="number"
          min="0"
          className={styles.input}
          placeholder="Daj ponavljanja"
          value={reps}
          onChange={(event) => setReps(event.target.value)}
        />
        <button
          className={styles.calculateButton}
          onClick={calculate}
          disabled={!weight || !reps}
        >
          Calculate
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {oneRM && <p className={styles.result}>1RM: {oneRM} kg</p>}

      <div className={styles.optionsRow}>
        <input
          type="number"
          min={MIN_STEP}
          className={styles.input}
          placeholder="Daj postotak skoka"
          value={step}
          onChange={(event) => setStep(parseFloat(event.target.value))}
        />
        <input
          type="number"
          min={MIN_PERCENTAGE}
          max={MAX_PERCENTAGE}
          className={styles.input}
          placeholder="Daj postotak(default do 70%)"
          value={minPct}
          onChange={(event) => setMinPct(parseFloat(event.target.value))}
        />
      </div>

      {oneRM && (
        <table className={styles.table}>
          <tbody>
            {percentages.map((pct) => (
              <tr key={pct}>
                <td>{pct}%</td>
                <td>{((oneRM * pct) / 100).toFixed(2)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Calculator;
