import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { fetchJson, UNAUTHORIZED_EVENT } from "./api";
import PageErrorBoundary from "./components/PageErrorBoundary";
import { useOutboxSync } from "./hooks/useOutbox";
import { ToastProvider } from "./context/ToastContext";
import { SettingsProvider } from "./context/SettingsContext";
import { RestTimerProvider } from "./context/RestTimerContext";
import ToastContainer from "./components/ToastContainer";
import RestTimer from "./components/RestTimer";
import NavBar from "./components/NavBar";
import styles from "./App.module.css";

// Each page is a file of its own, loaded when it is first opened, so the app starts with less to
// download and run (the charts library, for one, only comes with the pages that draw charts).
const PAGES = {
  Dashboard: () => import("./pages/Dashboard"),
  Log: () => import("./pages/Log"),
  Programs: () => import("./pages/Programs"),
  Nutrition: () => import("./pages/Nutrition"),
  Calendar: () => import("./pages/Calendar"),
  Calculator: () => import("./pages/Calculator"),
  Stats: () => import("./pages/Stats"),
  Settings: () => import("./pages/Settings"),
};
const Dashboard = lazy(PAGES.Dashboard);
const Log = lazy(PAGES.Log);
const Programs = lazy(PAGES.Programs);
const Nutrition = lazy(PAGES.Nutrition);
const Calendar = lazy(PAGES.Calendar);
const Calculator = lazy(PAGES.Calculator);
const Stats = lazy(PAGES.Stats);
const Settings = lazy(PAGES.Settings);
const Login = lazy(() => import("./pages/Login"));

// Once the app is up, the other pages load in the background while nothing else is going on:
// moving between pages stays instant, and the service worker keeps every page for offline use.
function loadOtherPagesWhenIdle() {
  const loadAll = () => Object.values(PAGES).forEach((load) => load().catch(() => {}));
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(loadAll, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(loadAll, 2000);
  return () => window.clearTimeout(id);
}

// In place of a page that could not load: most likely its file, while offline.
function PageLoadError() {
  const { t } = useTranslation();
  return (
    <div className={styles.pageError}>
      <div className={styles.pageErrorCard} role="alert">
        <p>{t("errors.pageLoad")}</p>
        <button
          type="button"
          className={styles.retryButton}
          onClick={() => window.location.reload()}
        >
          {t("common.tryAgain")}
        </button>
      </div>
    </div>
  );
}

// Sends the workout changes made without a connection once it is back, whatever page is open.
function OutboxSync() {
  useOutboxSync();
  return null;
}

function PageRoutes() {
  const { pathname } = useLocation();
  return (
    <PageErrorBoundary resetKey={pathname} fallback={<PageLoadError />}>
      {/* Nothing in place of a page while its file loads: usually a blink, and the navigation
          stays put. */}
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/log" element={<Log />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </PageErrorBoundary>
  );
}

const AUTH_STATES = {
  checking: "checking",
  required: "required",
  ok: "ok",
};

function App() {
  const [authState, setAuthState] = useState(AUTH_STATES.checking);

  useEffect(() => {
    fetchJson("/api/auth/status")
      .then((data) => {
        setAuthState(data.required && !data.authenticated ? AUTH_STATES.required : AUTH_STATES.ok);
      })
      .catch((err) => {
        // Backend unreachable: let the pages show their own errors.
        console.error(err);
        setAuthState(AUTH_STATES.ok);
      });

    const handleUnauthorized = () => setAuthState(AUTH_STATES.required);
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  useEffect(() => {
    if (authState === AUTH_STATES.ok) return loadOtherPagesWhenIdle();
  }, [authState]);

  if (authState === AUTH_STATES.checking) {
    return null;
  }

  if (authState === AUTH_STATES.required) {
    return (
      <Suspense fallback={null}>
        <Login onLogin={() => setAuthState(AUTH_STATES.ok)} />
      </Suspense>
    );
  }

  return (
    <ToastProvider>
      <SettingsProvider>
        <RestTimerProvider>
          <BrowserRouter>
            <NavBar />
            <div className={styles.routes}>
              <PageRoutes />
            </div>
          </BrowserRouter>
          <ToastContainer />
          <RestTimer />
          <OutboxSync />
        </RestTimerProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}

export default App;
