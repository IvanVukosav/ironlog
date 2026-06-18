import { useState } from "react";

function Calculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);
  const [step, setStep] = useState(5);
  const [minPct, setMinPct] = useState(70);

  const calculate = () => {
    const result = weight / (1.0278 - 0.0278 * reps);
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
        onChange={(e) => setStep(e.target.value)}
      />
      <input
        type="number"
        placeholder="Daj postotak(default do 70%)"
        value={minPct}
        onChange={(e) => setMinPct(e.target.value)}
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
