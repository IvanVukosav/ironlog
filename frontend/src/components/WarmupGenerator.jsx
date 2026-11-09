import { useState } from "react";
import { useTranslation } from "react-i18next";
import { buildWarmupSets, calculatePlates } from "../utils/plates";
import styles from "./WarmupGenerator.module.css";

function WarmupGenerator({ setup, onSelectWeight }) {
  const { t } = useTranslation();
  const [workingWeight, setWorkingWeight] = useState("");
  const warmupSets = buildWarmupSets(parseFloat(workingWeight), setup);

  return (
    <div>
      <input
        type="number"
        min="0"
        step="0.5"
        className={styles.input}
        placeholder={t("calculator.workingWeightPlaceholder")}
        value={workingWeight}
        onChange={(event) => setWorkingWeight(event.target.value)}
      />

      {warmupSets.length > 0 && (
        <table className={styles.table}>
          <tbody>
            {warmupSets.map((warmupSet) => {
              const plates = calculatePlates(warmupSet.weight, setup);
              return (
                <tr
                  key={warmupSet.weight}
                  className={styles.row}
                  title={t("calculator.loadIntoPlates")}
                  onClick={() => onSelectWeight(warmupSet.weight)}
                >
                  <td>
                    {warmupSet.percent ? `${warmupSet.percent}%` : t("calculator.emptyBarShort")}
                  </td>
                  <td>
                    {t("calculator.warmupSet", { weight: warmupSet.weight, reps: warmupSet.reps })}
                  </td>
                  <td className={styles.platesCell}>{plates?.platesPerSide.join(" + ") || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default WarmupGenerator;
