import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../context/useToast";
import { errorMessage } from "../utils/errorMessages";

/**
 * The app's answer to a failed request: log it and show it as an error toast, in the page's
 * language. Made to be passed straight to `.catch()`; the function stays the same between renders
 * (until the language changes).
 */
export function useReportError() {
  const { t } = useTranslation();
  const { showError } = useToast();
  return useCallback(
    (err) => {
      console.error(err);
      showError(errorMessage(err, t));
    },
    [showError, t],
  );
}
