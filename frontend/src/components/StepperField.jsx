import Icon from "./Icon";
import styles from "./StepperField.module.css";

/**
 * A number in a box with − and + inside it, beside its label: for sheets, where there is room
 * for the buttons on every screen. `less` and `more` are { label, run }.
 */
function StepperField({ id, label, value, inputMode, placeholder, less, more, onChange }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.stepper}>
        <button type="button" className={styles.step} aria-label={less.label} onClick={less.run}>
          <Icon name="minus" />
        </button>
        <input
          id={id}
          className={styles.input}
          inputMode={inputMode}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className={styles.step} aria-label={more.label} onClick={more.run}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}

export default StepperField;
