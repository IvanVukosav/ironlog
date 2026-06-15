import { BrowserRouter, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import Dashboard from "./pages/Dashboard";
import Log from "./pages/Log";
import Nutrition from "./pages/Nutrition";
import Calendar from "./pages/Calendar";
import Calculator from "./pages/Calculator";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";

function App() {
  return (
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
  );
}

export default App;
