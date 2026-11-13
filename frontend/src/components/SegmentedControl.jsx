import styles from "./SegmentedControl.module.css";

/**
 * A row of buttons with one pressed at a time: a period, a range. `options` are { value, label };
 * `label` names the group for screen readers. `compact` is the smaller one for inside a card.
 */
function SegmentedControl({ label, options, value, onChange, compact = false }) {
  return (
    <div
      className={compact ? `${styles.group} ${styles.compact}` : styles.group}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.option}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;
