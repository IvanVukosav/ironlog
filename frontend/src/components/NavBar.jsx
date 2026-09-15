import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./Navbar.css";

function NavBar() {
  const { t } = useTranslation();
  return (
    <nav>
      <Link to="/">{t("nav.dashboard")}</Link>
      <Link to="/log">{t("nav.log")}</Link>
      <Link to="/nutrition">{t("nav.nutrition")}</Link>
      <Link to="/calendar">{t("nav.calendar")}</Link>
      <Link to="/calculator">{t("nav.calculator")}</Link>
      <Link to="/stats">{t("nav.stats")}</Link>
      <Link to="/settings">{t("nav.settings")}</Link>
    </nav>
  );
}

export default NavBar;
