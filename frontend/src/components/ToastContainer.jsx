import { useToast } from "../context/useToast";
import styles from "./ToastContainer.module.css";

function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={toast.type === "success" ? styles.toastSuccess : styles.toastError}
        >
          <span className={styles.message}>{toast.message}</span>
          <button className={styles.closeButton} onClick={() => dismissToast(toast.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;
