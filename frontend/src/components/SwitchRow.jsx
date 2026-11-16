import styles from "./SwitchRow.module.css";

/**
 * Something that is on or off: its name, and what it does under it, with a switch at the end.
 * The whole row is the button, so it is easy to hit on a phone.
 */
function SwitchRow({ label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={styles.row}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
      <span
        className={checked ? `${styles.switch} ${styles.on}` : styles.switch}
        aria-hidden="true"
      >
        <span className={styles.knob} />
      </span>
    </button>
  );
}

export default SwitchRow;
