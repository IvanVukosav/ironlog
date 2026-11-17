import { useId } from "react";
import { useTranslation } from "react-i18next";
import { stepNumber, toInputText } from "../utils/numbers";
import Icon from "./Icon";
import styles from "./NumberField.module.css";

/**
 * A labelled box for a number. It keeps the text as typed, so a decimal comma survives until the
 * number is read with parseDecimal. `inputMode` picks the phone keypad: "decimal", or "numeric"
 * for whole numbers. With `step` ({ by, start, min, max, less, more }; `less` and `more` name the
 * buttons for a screen reader) a phone shows − and + around the number, in one row with its
 * name; a computer keeps the plain box. Anything else (onBlur, onKeyDown) goes to the input.
 */
function NumberField({ label, value, onChange, inputMode = "decimal", step, ...inputProps }) {
  const id = useId();
  const { i18n } = useTranslation();

  // Whole numbers stay whole; the others get the language's decimal mark, as if typed.
  const stepBy = (amount) => {
    const next = stepNumber(value, amount, step);
    onChange(inputMode === "numeric" ? String(next) : toInputText(next, i18n.language));
  };

  return (
    <div className={step ? `${styles.field} ${styles.stepped}` : styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.control}>
        {step && (
          <button
            type="button"
            className={styles.step}
            aria-label={step.less}
            onClick={() => stepBy(-step.by)}
          >
            <Icon name="minus" />
          </button>
        )}
        <input
          id={id}
          className={styles.input}
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...inputProps}
        />
        {step && (
          <button
            type="button"
            className={styles.step}
            aria-label={step.more}
            onClick={() => stepBy(step.by)}
          >
            <Icon name="plus" />
          </button>
        )}
      </div>
    </div>
  );
}

export default NumberField;
