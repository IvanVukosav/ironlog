import { useId } from "react";
import Icon from "./Icon";
import styles from "./LoadList.module.css";

/**
 * Weights as rows, each a button that hands its weight on (to the plate calculator). `rows` are
 * { key, label, value, detail, weight }: "90 %", "101,3 kg" and, if there is one, a detail such
 * as the plates for it. `action` says what a tap does; screen readers hear it after each row.
 */
function LoadList({ rows, action, onSelect }) {
  const actionId = useId();
  return (
    <>
      <span id={actionId} hidden>
        {action}
      </span>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              className={styles.row}
              title={action}
              aria-describedby={actionId}
              onClick={() => onSelect(row.weight)}
            >
              <span className={styles.label}>{row.label}</span>
              <span className={styles.main}>
                <span className={styles.value}>{row.value}</span>
                {row.detail && <span className={styles.detail}>{row.detail}</span>}
              </span>
              <span className={styles.chevron}>
                <Icon name="chevronRight" size={16} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export default LoadList;
