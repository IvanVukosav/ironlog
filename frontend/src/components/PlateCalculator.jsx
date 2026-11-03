import { useTranslation } from "react-i18next";
import {
  BAR_WEIGHTS_KG,
  COLLAR_WEIGHT_KG,
  PLATE_STYLES,
  STANDARD_PLATES_KG,
  calculatePlates,
} from "../utils/plates";
import styles from "./PlateCalculator.module.css";

function Barbell({ plates }) {
  const renderPlate = (plate, index) => (
    <span
      key={index}
      className={styles.plate}
      style={{
        backgroundColor: PLATE_STYLES[plate].color,
        height: `${PLATE_STYLES[plate].height}%`,
        width: PLATE_STYLES[plate].width,
      }}
      title={`${plate} kg`}
    />
  );

  // Left side runs outside-in (lightest first), right side inside-out.
  return (
    <div className={styles.barbell} aria-hidden="true">
      <span className={styles.sleeve} />
      {[...plates].reverse().map(renderPlate)}
      <span className={styles.stop} />
      <span className={styles.shaft} />
      <span className={styles.stop} />
      {plates.map(renderPlate)}
      <span className={styles.sleeve} />
    </div>
  );
}

function PlateCalculator({ target, onTargetChange, setup, onSetupChange }) {
  const { t } = useTranslation();
  const targetKg = parseFloat(target);
  const result = Number.isFinite(targetKg) ? calculatePlates(targetKg, setup) : null;
  const emptyBarKg = setup.barWeight + (setup.useCollars ? COLLAR_WEIGHT_KG * 2 : 0);

  const togglePlate = (plate) => {
    const availablePlates = setup.availablePlates.includes(plate)
      ? setup.availablePlates.filter((availablePlate) => availablePlate !== plate)
      : [...setup.availablePlates, plate];
    onSetupChange({ ...setup, availablePlates });
  };

  return (
    <div>
      <div className={styles.inputRow}>
        <input
          type="number"
          min="0"
          step="0.5"
          className={styles.input}
          placeholder={t("calculator.targetWeightPlaceholder")}
          value={target}
          onChange={(event) => onTargetChange(event.target.value)}
        />
        <label className={styles.inlineField}>
          {t("calculator.bar")}
          <select
            className={styles.select}
            value={setup.barWeight}
            onChange={(event) => onSetupChange({ ...setup, barWeight: parseFloat(event.target.value) })}
          >
            {BAR_WEIGHTS_KG.map((barWeight) => (
              <option key={barWeight} value={barWeight}>
                {barWeight} kg
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inlineField}>
          <input
            type="checkbox"
            checked={setup.useCollars}
            onChange={(event) => onSetupChange({ ...setup, useCollars: event.target.checked })}
          />
          {t("calculator.collars", { weight: COLLAR_WEIGHT_KG })}
        </label>
      </div>

      <div className={styles.plateToggles}>
        <span className={styles.label}>{t("calculator.availablePlates")}</span>
        {STANDARD_PLATES_KG.map((plate) => {
          const isAvailable = setup.availablePlates.includes(plate);
          return (
            <button
              type="button"
              key={plate}
              className={isAvailable ? `${styles.plateToggle} ${styles.plateToggleActive}` : styles.plateToggle}
              aria-pressed={isAvailable}
              onClick={() => togglePlate(plate)}
            >
              {plate}
            </button>
          );
        })}
      </div>

      {Number.isFinite(targetKg) && (result ? (
        <>
          <Barbell plates={result.platesPerSide} />
          <p className={styles.result}>
            {result.platesPerSide.length > 0
              ? t("calculator.perSide", { plates: result.platesPerSide.join(" + ") })
              : t("calculator.emptyBar")}
          </p>
          {result.remainderKg > 0 && (
            <p className={styles.warning}>
              {t("calculator.closestLoad", { loaded: result.loadedKg, missing: result.remainderKg })}
            </p>
          )}
        </>
      ) : targetKg < emptyBarKg && (
        <p className={styles.warning}>{t("calculator.belowBar", { weight: emptyBarKg })}</p>
      ))}
    </div>
  );
}

export default PlateCalculator;
