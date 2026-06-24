import { useState, useEffect } from "react";
import { fetchJson } from "../api";

function Stats() {
  const [prs, setPrs] = useState([]);

  useEffect(() => {
    fetchJson("/api/stats/prs")
      .then((data) => setPrs(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="page">
      <h1>Stats</h1>
      <table>
        <thead>
          <tr>
            <th>Exercise</th>
            <th>Max Weight</th>
            <th>Reps</th>
          </tr>
        </thead>
        <tbody>
          {prs.map((pr) => (
            <tr key={pr.name + pr.weight}>
              <td>{pr.name}</td>
              <td>{pr.weight}kg</td>
              <td>{pr.reps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Stats;
