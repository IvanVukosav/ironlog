import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NavIcon from "./NavIcon";
import styles from "./NavBar.module.css";

// Every page; the ones marked `tab` get their own place in the phone tab bar, the rest sit
// under "More" there.
const LINKS = [
  { to: "/", key: "dashboard", icon: "home", tab: true },
  { to: "/log", key: "log", icon: "workout", tab: true },
  { to: "/programs", key: "programs", icon: "programs" },
  { to: "/nutrition", key: "nutrition", icon: "nutrition", tab: true },
  { to: "/calendar", key: "calendar", icon: "calendar" },
  { to: "/calculator", key: "calculator", icon: "calculator" },
  { to: "/stats", key: "stats", icon: "stats", tab: true },
  { to: "/settings", key: "settings", icon: "settings" },
];
const TAB_LINKS = LINKS.filter((link) => link.tab);
const MORE_LINKS = LINKS.filter((link) => !link.tab);

const withActive =
  (base, active) =>
  ({ isActive }) =>
    isActive ? `${base} ${active}` : base;

function NavBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const onMorePage = MORE_LINKS.some((link) => pathname.startsWith(link.to));

  useEffect(() => {
    if (!moreOpen) return undefined;
    const closeOutside = (event) => {
      if (!moreRef.current?.contains(event.target)) setMoreOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreOpen]);

  return (
    <>
      <nav className={styles.topNav} aria-label={t("nav.main")}>
        <span className={styles.brand}>
          <NavIcon name="workout" size={22} />
          Iron Log
        </span>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={withActive(styles.link, styles.linkActive)}
          >
            {t(`nav.${link.key}`)}
          </NavLink>
        ))}
      </nav>

      <nav className={styles.tabBar} aria-label={t("nav.main")}>
        {TAB_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={withActive(styles.tab, styles.tabActive)}
          >
            <NavIcon name={link.icon} />
            <span>{t(`nav.${link.key}`)}</span>
          </NavLink>
        ))}
        <div className={styles.moreWrapper} ref={moreRef}>
          <button
            type="button"
            className={onMorePage || moreOpen ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((open) => !open)}
          >
            <NavIcon name="more" />
            <span>{t("nav.more")}</span>
          </button>
          {moreOpen && (
            <div className={styles.moreMenu} role="menu">
              {MORE_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  role="menuitem"
                  className={withActive(styles.moreItem, styles.moreItemActive)}
                  onClick={() => setMoreOpen(false)}
                >
                  <NavIcon name={link.icon} size={20} />
                  {t(`nav.${link.key}`)}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}

export default NavBar;
