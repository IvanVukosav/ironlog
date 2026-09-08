import { useCallback, useRef, useState } from "react";
import { ToastContext } from "./toastContextDefinition";

const TOAST_DURATION_MS = 4000;

const TOAST_TYPES = {
  error: "error",
  success: "success",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextIdRef = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type) => {
    const id = nextIdRef.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
  }, [dismissToast]);

  const showError = useCallback(
    (message) => showToast(message, TOAST_TYPES.error),
    [showToast],
  );
  const showSuccess = useCallback(
    (message) => showToast(message, TOAST_TYPES.success),
    [showToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, showError, showSuccess, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}
