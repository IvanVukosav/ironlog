import { useState } from "react";
import { useTranslation } from "react-i18next";
import { buildWarmupSets, calculatePlates } from "../utils/plates";
import { formatNumber, formatPercent, parseDecimal } from "../utils/numbers";
import LoadList from "./LoadList";
import NumberField from "./NumberField";
import styles from "./WarmupGenerator.module.css";

// The ramp up to a working weight, each step with the plates for one side of the bar.
function WarmupGenerator({ setup, onSelectWeight }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [workingWeight, setWorkingWeight] = useState("");
  const kg = (value) => formatNumber(value, language);
  const warmupSets = buildWarmupSets(parseDecimal(workingWeight), setup);

  return (
    <>
      <div className={styles.target}>
        <NumberField
          label={t("calculator.workingWeightLabel")}
          value={workingWeight}
          onChange={setWorkingWeight}
        />
      </div>
      {warmupSets.length > 0 && (
        <LoadList
          rows={warmupSets.map((warmupSet) => ({
            key: warmupSet.weight,
            label: warmupSet.percent
              ? formatPercent(warmupSet.percent, language)
              : t("calculator.emptyBarShort"),
            value: t("calculator.warmupSet", {
              weight: kg(warmupSet.weight),
              reps: warmupSet.reps,
            }),
            detail: calculatePlates(warmupSet.weight, setup)?.platesPerSide.map(kg).join(" + "),
            weight: warmupSet.weight,
          }))}
          action={t("calculator.loadIntoPlates")}
          onSelect={onSelectWeight}
        />
      )}
    </>
  );
}

export default WarmupGenerator;
