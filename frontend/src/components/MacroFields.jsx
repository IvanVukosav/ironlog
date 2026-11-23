import { useId } from "react";
import { useTranslation } from "react-i18next";
import styles from "./MacroFields.module.css";

const FIELDS = [
  { key: "kcal", labelKey: "nutrition.kcalLabel" },
  { key: "protein", labelKey: "nutrition.proteinLabel" },
  { key: "carbs", labelKey: "nutrition.carbsLabel" },
  { key: "fat", labelKey: "nutrition.fatLabel" },
];

/**
 * A food's kcal and its three macros, each in a box under its label. `values` holds them as
 * typed (strings), and `onChange` gets all of `values` with the one that changed.
 */
function MacroFields({ values, onChange }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.macroFields}>
      {FIELDS.map(({ key, labelKey }) => (
        <div key={key} className={styles.field} data-field={key}>
          <label className={styles.fieldLabel} htmlFor={`${id}${key}`}>
            {t(labelKey)}
          </label>
          <input
            id={`${id}${key}`}
            className={styles.fieldInput}
            inputMode="decimal"
            autoComplete="off"
            value={values[key]}
            onChange={(event) => onChange({ ...values, [key]: event.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

export default MacroFields;
