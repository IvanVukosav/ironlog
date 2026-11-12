import { useCallback } from "react";
import { useToast } from "../context/useToast";

/**
 * The app's answer to a failed request: log it and show its message as an error toast.
 * Made to be passed straight to `.catch()`; the function stays the same between renders.
 */
export function useReportError() {
  const { showError } = useToast();
  return useCallback(
    (err) => {
      console.error(err);
      showError(err.message);
    },
    [showError],
  );
}
