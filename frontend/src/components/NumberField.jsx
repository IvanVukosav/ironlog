import { useId } from "react";
import styles from "./NumberField.module.css";

/**
 * A labelled box for a number. It keeps the text as typed, so a decimal comma survives until the
 * number is read with parseDecimal. `inputMode` picks the phone keypad: "decimal", or "numeric"
 * for whole numbers. Anything else (onBlur, onKeyDown) goes to the input itself.
 */
function NumberField({ label, value, onChange, inputMode = "decimal", ...inputProps }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
    </div>
  );
}

export default NumberField;
