import { useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson, setToken } from "../api";
import styles from "./Login.module.css";

function Login({ onLogin }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!password) return;

    setSubmitting(true);
    setError(null);
    fetchJson("/api/auth/login", {
      method: "POST",
      json: { password },
    })
      .then((data) => {
        setToken(data.token);
        onLogin();
      })
      .catch((err) => {
        const knownErrors = {
          "Wrong password": t("auth.wrongPassword"),
          "Too many attempts": t("auth.tooManyAttempts"),
        };
        setError(knownErrors[err.message] ?? err.message);
        setSubmitting(false);
      });
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.heading}>Iron Log</h1>
        <label className={styles.fieldLabel} htmlFor="login-password">
          {t("auth.password")}
        </label>
        <input
          id="login-password"
          type="password"
          autoFocus
          autoComplete="current-password"
          className={styles.input}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.button} disabled={!password || submitting}>
          {t("auth.login")}
        </button>
      </form>
    </div>
  );
}

export default Login;
