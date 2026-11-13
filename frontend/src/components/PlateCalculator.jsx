import { useTranslation } from "react-i18next";
import {
  BAR_WEIGHTS_KG,
  COLLAR_WEIGHT_KG,
  PLATE_STYLES,
  STANDARD_PLATES_KG,
  calculatePlates,
} from "../utils/plates";
import { formatNumber, parseDecimal } from "../utils/numbers";
import NumberField from "./NumberField";
import SegmentedControl from "./SegmentedControl";
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

// A total to load: the plates for each side, drawn and listed, and below them the bar, collars
// and plates there are to load it with (kept by the page).
function PlateCalculator({ target, onTargetChange, setup, onSetupChange }) {
  const { t, i18n } = useTranslation();
  const kg = (value) => formatNumber(value, i18n.language);
  const targetKg = parseDecimal(target);
  const hasTarget = Number.isFinite(targetKg);
  const result = hasTarget ? calculatePlates(targetKg, setup) : null;
  const emptyBarKg = setup.barWeight + (setup.useCollars ? COLLAR_WEIGHT_KG * 2 : 0);

  const togglePlate = (plate) => {
    const availablePlates = setup.availablePlates.includes(plate)
      ? setup.availablePlates.filter((availablePlate) => availablePlate !== plate)
      : [...setup.availablePlates, plate];
    onSetupChange({ ...setup, availablePlates });
  };

  return (
    <>
      <div className={styles.target}>
        <NumberField
          label={t("calculator.targetWeightLabel")}
          value={target}
          onChange={onTargetChange}
        />
      </div>

      {result && (
        <div className={styles.result}>
          <Barbell plates={result.platesPerSide} />
          <p className={styles.perSide}>
            {result.platesPerSide.length > 0
              ? t("calculator.perSide", { plates: result.platesPerSide.map(kg).join(" + ") })
              : t("calculator.emptyBar")}
          </p>
          {result.remainderKg > 0 && (
            <p className={styles.note}>
              {t("calculator.closestLoad", {
                loaded: kg(result.loadedKg),
                missing: kg(result.remainderKg),
              })}
            </p>
          )}
        </div>
      )}
      {hasTarget && !result && targetKg < emptyBarKg && (
        <p className={styles.note}>{t("calculator.belowBar", { weight: kg(emptyBarKg) })}</p>
      )}

      <div className={styles.setup}>
        <div className={styles.setupRow}>
          <span className={styles.setupLabel} aria-hidden="true">
            {t("calculator.bar")}
          </span>
          <div className={styles.setupOptions}>
            <SegmentedControl
              compact
              label={t("calculator.bar")}
              options={BAR_WEIGHTS_KG.map((barWeight) => ({
                value: barWeight,
                label: `${kg(barWeight)} kg`,
              }))}
              value={setup.barWeight}
              onChange={(barWeight) => onSetupChange({ ...setup, barWeight })}
            />
            <button
              type="button"
              className={styles.chip}
              aria-pressed={setup.useCollars}
              onClick={() => onSetupChange({ ...setup, useCollars: !setup.useCollars })}
            >
              {t("calculator.collars", { weight: kg(COLLAR_WEIGHT_KG) })}
            </button>
          </div>
        </div>
        <div className={styles.setupRow}>
          <span className={styles.setupLabel} aria-hidden="true">
            {t("calculator.availablePlates")}
          </span>
          <div
            className={styles.setupOptions}
            role="group"
            aria-label={t("calculator.availablePlates")}
          >
            {STANDARD_PLATES_KG.map((plate) => (
              <button
                type="button"
                key={plate}
                className={styles.chip}
                aria-pressed={setup.availablePlates.includes(plate)}
                onClick={() => togglePlate(plate)}
              >
                <span
                  className={styles.swatch}
                  style={{ backgroundColor: PLATE_STYLES[plate].color }}
                  aria-hidden="true"
                />
                {kg(plate)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default PlateCalculator;
