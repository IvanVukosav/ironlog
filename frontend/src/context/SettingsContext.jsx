import { useCallback, useEffect, useMemo, useState } from "react";
import i18n from "../i18n";
import { fetchJson } from "../api";
import { useReportError } from "../hooks/useReportError";
import { SettingsContext } from "./settingsContextDefinition";

/**
 * Loads the settings once for the whole app, keeps the page's theme, template and language in
 * step with them, and saves changes. `updateSettings(patch)` shows a change at once and resolves
 * to whether it was saved; if saving fails, the error is shown and the changed fields go back.
 */
export function SettingsProvider({ children }) {
  const reportError = useReportError();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchJson("/api/settings").then(setSettings).catch(reportError);
  }, [reportError]);

  const theme = settings?.theme;
  const template = settings?.template;
  const language = settings?.language;
  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (template) document.documentElement.setAttribute("data-template", template);
  }, [template]);
  useEffect(() => {
    if (language && language !== i18n.language) i18n.changeLanguage(language);
  }, [language]);

  const updateSettings = useCallback(
    (patch) => {
      // Only the fields this change touches go back, so another change that did save stays.
      const previous = Object.fromEntries(Object.keys(patch).map((key) => [key, settings?.[key]]));
      setSettings((current) => ({ ...current, ...patch }));
      return fetchJson("/api/settings", {
        method: "PUT",
        json: patch,
      }).then(
        () => true,
        (err) => {
          reportError(err);
          setSettings((current) => ({ ...current, ...previous }));
          return false;
        },
      );
    },
    [settings, reportError],
  );

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
