import { useState } from "react";

const BRZYCKI_A = 1.0278;
const BRZYCKI_B = 0.0278;

function Calculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);
  const [step, setStep] = useState(5);
  const [minPct, setMinPct] = useState(70);

  const calculate = () => {
    const result = weight / (BRZYCKI_A - BRZYCKI_B * reps);
    setOneRM(parseFloat(result.toFixed(2)));
  };

  const percentages = [];
  for (let pct = 100; pct >= minPct; pct -= step) {
    percentages.push(pct);
  }

  return (
    <div className="page">
      <h1>Calculator</h1>
      <input
        type="number"
        placeholder="Daj kilazicu"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      <input
        type="number"
        placeholder="Daj ponavljanja"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
      />
      <button onClick={calculate}>Calculate</button>
      {oneRM && <p>1RM: {oneRM} kg</p>}
      <input
        type="number"
        placeholder="Daj postotak skoka"
        value={step}
        onChange={(e) => setStep(parseFloat(e.target.value))}
      />
      <input
        type="number"
        placeholder="Daj postotak(default do 70%)"
        value={minPct}
        onChange={(e) => setMinPct(parseFloat(e.target.value))}
      />

      {oneRM && (
        <table>
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
