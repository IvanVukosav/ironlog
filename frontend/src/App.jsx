import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import i18n from "./i18n";
import { fetchJson } from "./api";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/ToastContainer";
import RestTimer from "./components/RestTimer";
import NavBar from "./components/NavBar";
import Dashboard from "./pages/Dashboard";
import Log from "./pages/Log";
import Nutrition from "./pages/Nutrition";
import Calendar from "./pages/Calendar";
import Calculator from "./pages/Calculator";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";

function App() {
  useEffect(() => {
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
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/log" element={<Log />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer />
      <RestTimer />
    </ToastProvider>
  );
}

export default App;
