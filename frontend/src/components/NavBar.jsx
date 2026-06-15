import { Link } from "react-router-dom";
import "./Navbar.css";

function NavBar() {
  return (
    <nav>
      <Link to="/">Dashboard</Link>
      <Link to="/log">Log</Link>
      <Link to="/nutrition">Nutrition</Link>
      <Link to="/calendar">Calendar</Link>
      <Link to="/calculator">Calculator</Link>
      <Link to="/stats">Stats</Link>
      <Link to="/settings">Settings</Link>
    </nav>
  );
}

export default NavBar;
