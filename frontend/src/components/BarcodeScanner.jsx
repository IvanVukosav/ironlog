import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useBarcodeCamera } from "../hooks/useBarcodeCamera";
import { normalizeBarcode } from "../utils/barcode";
import { errorMessage } from "../utils/errorMessages";
import { amountChoices, portionName, portionOf, startingAmount } from "../utils/foodPortion";
import {
  formatNumber,
  parseDecimal,
  stepNumber,
  toDecimalText,
  toInputText,
} from "../utils/numbers";
import Icon from "./Icon";
import StepperField from "./StepperField";
import SwitchRow from "./SwitchRow";
import styles from "./BarcodeScanner.module.css";

const AMOUNT_STEP = 10;
const EMPTY_PRODUCT = { name: "", kcal: "", protein: "", carbs: "", fat: "", packageSize: "" };
const PRODUCT_FIELDS = [
  { key: "kcal", labelKey: "nutrition.kcalLabel" },
  { key: "protein", labelKey: "nutrition.proteinLabel" },
  { key: "carbs", labelKey: "nutrition.carbsLabel" },
  { key: "fat", labelKey: "nutrition.fatLabel" },
];

// A found product: how much of it was eaten, what that holds, and adding it to the meal.
function FoundProduct({ product, mealName, onAdd, onScanAgain, isFavourite, onSaveFavourite }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const id = useId();
  const [amountText, setAmountText] = useState(() =>
    toInputText(startingAmount(product), language),
  );
  const [keepAsFavourite, setKeepAsFavourite] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const amount = parseDecimal(amountText);
  const portion = amount > 0 ? portionOf(product, amount) : null;
  const unit = product.unit;
  const grams = (value) => formatNumber(value, language, { maxDecimals: 1 });

  const add = async () => {
    const food = { name: portionName(product, amount, language), ...portion };
    setIsAdding(true);
    const saved = await onAdd(food);
    setIsAdding(false);
    if (saved && keepAsFavourite && !isFavourite(food.name)) onSaveFavourite(food);
  };

  const step = (by) =>
    setAmountText(
      toInputText(stepNumber(amountText, by, { start: startingAmount(product) }), language),
    );

  const detail = [
    product.brand,
    product.packageSize && t("scanner.packageSize", { size: grams(product.packageSize), unit }),
    t("scanner.per100", {
      unit,
      kcal: formatNumber(product.kcal, language, { maxDecimals: 0 }),
      protein: grams(product.protein),
      carbs: grams(product.carbs),
      fat: grams(product.fat),
    }),
  ]
    .filter(Boolean)
    .join(" · ");

  const tiles = [
    { label: t("scanner.tileKcal"), value: portion && formatNumber(portion.kcal, language) },
    { label: t("scanner.tileProtein"), value: portion && `${grams(portion.protein)} g` },
    { label: t("scanner.tileCarbs"), value: portion && `${grams(portion.carbs)} g` },
    { label: t("scanner.tileFat"), value: portion && `${grams(portion.fat)} g` },
  ];

  return (
    <>
      <div className={styles.resultHeader}>
        <span className={styles.badgeFound}>{t("scanner.found")}</span>
        <h3 className={styles.resultTitle}>{product.name}</h3>
        <p className={styles.resultDetail}>{detail}</p>
      </div>
      <StepperField
        id={`${id}amount`}
        label={t("scanner.amount", { unit })}
        value={amountText}
        inputMode="decimal"
        less={{ label: t("scanner.less"), run: () => step(-AMOUNT_STEP) }}
        more={{ label: t("scanner.more"), run: () => step(AMOUNT_STEP) }}
        onChange={setAmountText}
      />
      <div className={styles.choices}>
        {amountChoices(product).map((choice) => {
          const size = `${grams(choice.amount)} ${unit}`;
          const label =
            choice.kind === "serving"
              ? t("scanner.choiceServing", { size })
              : choice.kind === "package"
                ? t("scanner.choiceWhole", { size })
                : size;
          return (
            <button
              type="button"
              key={choice.amount}
              className={styles.choice}
              aria-pressed={amount === choice.amount}
              onClick={() => setAmountText(toInputText(choice.amount, language))}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <span className={styles.tileLabel}>{tile.label}</span>
            <span className={styles.tileValue}>{tile.value ?? "–"}</span>
          </div>
        ))}
      </div>
      <SwitchRow
        label={t("scanner.saveFavourite")}
        hint={t("scanner.saveFavouriteHint")}
        checked={keepAsFavourite}
        onChange={setKeepAsFavourite}
      />
      <div className={styles.resultActions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!portion || isAdding}
          onClick={add}
        >
          {t("scanner.addTo", { meal: mealName })}
        </button>
        <button type="button" className={styles.secondary} onClick={onScanAgain}>
          {t("scanner.scanAgain")}
        </button>
      </div>
    </>
  );
}

// A barcode nobody has values for: the user types them from the package, and they are kept.
function NewProduct({ barcode, suggestedName, onSaved, onScanAgain }) {
  const { t } = useTranslation();
  const id = useId();
  const [form, setForm] = useState({ ...EMPTY_PRODUCT, name: suggestedName ?? "" });
  const [isSaving, setIsSaving] = useState(false);
  const [problem, setProblem] = useState(null);
  const isComplete = form.name.trim() !== "" && form.kcal.trim() !== "";

  const save = async () => {
    setIsSaving(true);
    setProblem(null);
    const grams = (value) => toDecimalText(value) || "0";
    try {
      const product = await fetchJson(`/api/food-products/${barcode}`, {
        method: "PUT",
        json: {
          name: form.name.trim(),
          kcal: toDecimalText(form.kcal),
          protein: grams(form.protein),
          carbs: grams(form.carbs),
          fat: grams(form.fat),
          packageSize: toDecimalText(form.packageSize) || null,
        },
      });
      onSaved(product);
    } catch (err) {
      setProblem(errorMessage(err, t));
      setIsSaving(false);
    }
  };

  return (
    <form
      className={styles.newProduct}
      onSubmit={(event) => {
        event.preventDefault();
        if (isComplete && !isSaving) save();
      }}
    >
      <div className={styles.resultHeader}>
        <span className={styles.badgeMissing}>{t("scanner.notFound")}</span>
        <h3 className={styles.resultTitle}>
          {suggestedName || t("scanner.barcodeTitle", { barcode })}
        </h3>
        <p className={styles.resultDetail}>{t("scanner.notFoundText")}</p>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}name`}>
          {t("scanner.productName")}
        </label>
        <input
          id={`${id}name`}
          className={styles.fieldInput}
          autoComplete="off"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </div>
      <span className={styles.groupLabel}>{t("scanner.per100Label")}</span>
      <div className={styles.macroFields}>
        {PRODUCT_FIELDS.map(({ key, labelKey }) => (
          <div key={key} className={styles.field} data-field={key}>
            <label className={styles.fieldLabel} htmlFor={`${id}${key}`}>
              {t(labelKey)}
            </label>
            <input
              id={`${id}${key}`}
              className={styles.fieldInput}
              inputMode="decimal"
              autoComplete="off"
              value={form[key]}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            />
          </div>
        ))}
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}package`}>
          {t("scanner.packageLabel")}
        </label>
        <input
          id={`${id}package`}
          className={styles.fieldInput}
          inputMode="decimal"
          autoComplete="off"
          value={form.packageSize}
          onChange={(event) => setForm({ ...form, packageSize: event.target.value })}
        />
      </div>
      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}
      <div className={styles.resultActions}>
        <button type="submit" className={styles.primary} disabled={!isComplete || isSaving}>
          {t("scanner.saveProduct")}
        </button>
        <button type="button" className={styles.secondary} onClick={onScanAgain}>
          {t("scanner.scanAgain")}
        </button>
      </div>
    </form>
  );
}

/**
 * Logging a packaged food by its barcode: the camera reads it (or it is typed), Open Food Facts
 * gives its values through the API, and the amount eaten goes into the meal. A product nobody
 * knows is typed in once and found from then on.
 *
 * It covers the whole phone screen (a dialog on a wider one). `onAdd(food)` adds the food to the
 * meal and resolves to what was saved, or null; `onTypeFood` leaves for the meal's own form.
 */
function BarcodeScanner({ mealName, onClose, onAdd, onTypeFood, isFavourite, onSaveFavourite }) {
  const { t } = useTranslation();
  const titleId = useId();
  const barcodeId = useId();
  const videoRef = useRef(null);
  const closeRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typedBarcode, setTypedBarcode] = useState("");
  const [typingProblem, setTypingProblem] = useState(null);
  // null while scanning; then { state: "looking" | "found" | "missing" | "failed", … }.
  const [lookup, setLookup] = useState(null);

  const lookUp = async (barcode) => {
    setLookup({ state: "looking", barcode });
    try {
      const answer = await fetchJson(`/api/food-products/${barcode}`);
      setLookup(
        answer.found
          ? { state: "found", product: answer.product }
          : { state: "missing", barcode, name: answer.name },
      );
    } catch (err) {
      setLookup({ state: "failed", barcode, message: errorMessage(err, t) });
    }
  };

  const { status, torch } = useBarcodeCamera({
    videoRef,
    isScanning: lookup === null && !isTyping,
    onRead: ({ rawValue, format }) => {
      const barcode = normalizeBarcode(rawValue, format);
      if (!barcode) return false;
      navigator.vibrate?.(40);
      lookUp(barcode);
      return true;
    },
  });
  const hasCamera = status === "on" || status === "starting";

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  const findTyped = () => {
    const barcode = normalizeBarcode(typedBarcode);
    if (!barcode) {
      setTypingProblem(t("scanner.invalidBarcode"));
      return;
    }
    setTypingProblem(null);
    lookUp(barcode);
  };

  const scanAgain = () => {
    setLookup(null);
    setTypedBarcode("");
    setIsTyping(false);
  };

  const add = async (food) => {
    const saved = await onAdd(food);
    if (saved) onClose();
    return saved;
  };

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
    >
      <div className={styles.dialog}>
        <div className={styles.screen}>
          <div className={styles.top}>
            <button
              ref={closeRef}
              type="button"
              className={styles.roundButton}
              aria-label={t("common.close")}
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
            <h2 id={titleId} className={styles.title}>
              {t("scanner.title")}
            </h2>
            {torch ? (
              <button
                type="button"
                className={styles.roundButton}
                aria-label={t("scanner.light")}
                aria-pressed={torch.on}
                onClick={torch.toggle}
              >
                <Icon name="bolt" />
              </button>
            ) : (
              <span className={styles.roundSpacer} aria-hidden="true" />
            )}
          </div>
          <span className={styles.meal}>{t("scanner.addingTo", { meal: mealName })}</span>

          <div className={styles.middle}>
            <div className={styles.viewfinder} hidden={!hasCamera}>
              <video ref={videoRef} className={styles.video} playsInline muted />
              <span className={styles.frame} aria-hidden="true" />
              {status === "on" && lookup === null && !isTyping && (
                <span className={styles.scanLine} aria-hidden="true" />
              )}
            </div>
            {hasCamera ? (
              <div className={styles.hint}>
                <strong className={styles.hintTitle}>{t("scanner.aim")}</strong>
                <span className={styles.hintText}>{t("scanner.aimHint")}</span>
              </div>
            ) : (
              <p className={styles.cameraNote} role="status">
                <Icon name="barcode" size={28} />
                {t(`scanner.camera.${status}`)}
              </p>
            )}
          </div>

          <div className={styles.bottom}>
            {isTyping || !hasCamera ? (
              <form
                className={styles.typed}
                onSubmit={(event) => {
                  event.preventDefault();
                  findTyped();
                }}
              >
                <label className={styles.typedLabel} htmlFor={barcodeId}>
                  {t("scanner.barcodeLabel")}
                </label>
                <div className={styles.typedRow}>
                  <input
                    id={barcodeId}
                    className={styles.typedInput}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t("scanner.barcodePlaceholder")}
                    value={typedBarcode}
                    onChange={(event) => {
                      setTypedBarcode(event.target.value);
                      setTypingProblem(null);
                    }}
                  />
                  <button
                    type="submit"
                    className={styles.typedButton}
                    disabled={typedBarcode.trim() === ""}
                  >
                    {t("scanner.find")}
                  </button>
                </div>
                {typingProblem && (
                  <p className={styles.typedProblem} role="alert">
                    {typingProblem}
                  </p>
                )}
              </form>
            ) : (
              <button type="button" className={styles.typeButton} onClick={() => setIsTyping(true)}>
                {t("scanner.typeBarcode")}
              </button>
            )}
            <button type="button" className={styles.linkButton} onClick={onTypeFood}>
              {t("scanner.typeFood")}
            </button>
          </div>
        </div>

        {lookup && (
          <section className={styles.result} aria-live="polite">
            <span className={styles.grabber} aria-hidden="true" />
            {lookup.state === "looking" && (
              <p className={styles.looking}>{t("scanner.looking", { barcode: lookup.barcode })}</p>
            )}
            {lookup.state === "found" && (
              <FoundProduct
                product={lookup.product}
                mealName={mealName}
                onAdd={add}
                onScanAgain={scanAgain}
                isFavourite={isFavourite}
                onSaveFavourite={onSaveFavourite}
              />
            )}
            {lookup.state === "missing" && (
              <NewProduct
                barcode={lookup.barcode}
                suggestedName={lookup.name}
                onSaved={(product) => setLookup({ state: "found", product })}
                onScanAgain={scanAgain}
              />
            )}
            {lookup.state === "failed" && (
              <>
                <div className={styles.resultHeader}>
                  <span className={styles.badgeMissing}>{t("scanner.lookupFailedBadge")}</span>
                  <p className={styles.resultDetail}>{lookup.message}</p>
                </div>
                <div className={styles.resultActions}>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => lookUp(lookup.barcode)}
                  >
                    {t("scanner.retry")}
                  </button>
                  <button type="button" className={styles.secondary} onClick={scanAgain}>
                    {t("scanner.scanAgain")}
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default BarcodeScanner;
