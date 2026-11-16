import { useTranslation } from "react-i18next";
import { useRestTimer } from "../context/useRestTimer";
import { useToast } from "../context/useToast";
import Icon from "./Icon";
import styles from "./ToastContainer.module.css";

// Messages after a save or a failure: top right on a wide screen. On a phone they come up at the
// bottom, above the tab bar (and above the rest timer while it shows), so they never cover the
// page's own controls at the top for the seconds they stay; while a sheet is open down there,
// they show at the top.
function ToastContainer() {
  const { t } = useTranslation();
  const { toasts, dismissToast } = useToast();
  const { secondsRemaining } = useRestTimer();

  if (toasts.length === 0) return null;

  return (
    <div
      className={
        secondsRemaining === null ? styles.container : `${styles.container} ${styles.aboveRest}`
      }
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        return (
          <div key={toast.id} className={styles.toast} role={isSuccess ? "status" : "alert"}>
            <span className={isSuccess ? styles.iconSuccess : styles.iconError}>
              <Icon name={isSuccess ? "check" : "alert"} size={18} />
            </span>
            <span className={styles.message}>{toast.message}</span>
            <button
              type="button"
              className={styles.closeButton}
              aria-label={t("common.closeMessage")}
              onClick={() => dismissToast(toast.id)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastContainer;
