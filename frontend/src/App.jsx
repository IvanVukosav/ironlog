import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import i18n from "./i18n";
import { fetchJson, UNAUTHORIZED_EVENT } from "./api";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/ToastContainer";
import RestTimer from "./components/RestTimer";
import NavBar from "./components/NavBar";
import styles from "./App.module.css";
import Dashboard from "./pages/Dashboard";
import Log from "./pages/Log";
import Nutrition from "./pages/Nutrition";
import Calendar from "./pages/Calendar";
import Calculator from "./pages/Calculator";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";
import Login from "./pages/Login";

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
    if (authState !== AUTH_STATES.ok) return;

    fetchJson("/api/settings")
      .then((data) => {
        if (data?.language && data.language !== i18n.language) {
          i18n.changeLanguage(data.language);
        }
        if (data?.theme && data.theme !== "dark-red") {
          document.documentElement.setAttribute("data-theme", data.theme);
        }
        if (data?.template && data.template !== "terminal") {
          document.documentElement.setAttribute("data-template", data.template);
        }
      })
      .catch((err) => console.error(err));
  }, [authState]);

  if (authState === AUTH_STATES.checking) {
    return null;
  }

  if (authState === AUTH_STATES.required) {
    return <Login onLogin={() => setAuthState(AUTH_STATES.ok)} />;
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <NavBar />
        <div className={styles.routes}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/log" element={<Log />} />
            <Route path="/nutrition" element={<Nutrition />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </BrowserRouter>
      <ToastContainer />
      <RestTimer />
    </ToastProvider>
  );
}

export default App;
