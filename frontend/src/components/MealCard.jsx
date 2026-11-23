import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_MEAL_NAME } from "../hooks/useNutritionDay";
import { dateKeyOf, dayBeforeKey, formatShortDate, todayKey } from "../utils/dates";
import { foodsMatching, nameKey } from "../utils/mealSuggestions";
import { formatNumber, toInputText } from "../utils/numbers";
import { sumMacros } from "../utils/nutritionState";
import BarcodeScanner from "./BarcodeScanner";
import Icon from "./Icon";
import styles from "./MealCard.module.css";

// The forms hold what was typed, so their fields are strings.
const EMPTY_FOOD = { name: "", kcal: "", protein: "", carbs: "", fat: "" };
const MACRO_FIELDS = [
  { key: "kcal", labelKey: "nutrition.kcalLabel" },
  { key: "protein", labelKey: "nutrition.proteinLabel" },
  { key: "carbs", labelKey: "nutrition.carbsLabel" },
  { key: "fat", labelKey: "nutrition.fatLabel" },
];

// A saved food in the form, its numbers written the way the language writes them ("12,5").
function formFromFood(food, language) {
  return {
    name: food.name,
    kcal: toInputText(food.kcal, language),
    protein: toInputText(food.protein, language),
    carbs: toInputText(food.carbs, language),
    fat: toInputText(food.fat, language),
  };
}

// A name and its kcal are enough; grams left empty count as 0.
const isComplete = (form) => form.name.trim() !== "" && form.kcal.trim() !== "";

// Closes an open list or menu (`setOpen(false)`) when a press lands outside `ref`.
function useCloseOnOutsidePress(isOpen, ref, setOpen) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePress = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePress);
    return () => document.removeEventListener("mousedown", handlePress);
  }, [isOpen, ref, setOpen]);
}

// Kcal and the three macros, each under its label.
function MacroFields({ values, onChange }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.macroFields}>
      {MACRO_FIELDS.map(({ key, labelKey }) => (
        <div key={key} className={styles.field} data-field={key}>
          <label className={styles.fieldLabel} htmlFor={`${id}${key}`}>
            {t(labelKey)}
          </label>
          <input
            id={`${id}${key}`}
            className={styles.fieldInput}
            inputMode="decimal"
            autoComplete="off"
            value={values[key]}
            onChange={(event) => onChange({ ...values, [key]: event.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

// Last time's meal of this name, offered while this one is still empty: one tap eats it again.
function PreviousMeal({ previous, date, onCopy }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [isCopying, setIsCopying] = useState(false);
  const previousKey = dateKeyOf(new Date(previous.date));
  const isYesterday = date === todayKey() && previousKey === dayBeforeKey(date);
  const total = sumMacros(previous.items);
  const detail = [
    isYesterday ? null : formatShortDate(previous.date, language),
    previous.items.map((item) => item.name).join(", "),
    `${formatNumber(total.kcal, language, { maxDecimals: 0 })} kcal`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.previous}>
      <span className={styles.previousIcon}>
        <Icon name="copy" />
      </span>
      <span className={styles.previousText}>
        <span className={styles.previousTitle}>
          {t(isYesterday ? "nutrition.likeYesterday" : "nutrition.likeLastTime")}
        </span>
        <span className={styles.previousDetail}>{detail}</span>
      </span>
      <button
        type="button"
        className={styles.previousButton}
        disabled={isCopying}
        onClick={async () => {
          setIsCopying(true);
          await onCopy(previous);
          setIsCopying(false);
        }}
      >
        {t("nutrition.copyMeal")}
      </button>
    </div>
  );
}

// A row of foods that go into the meal with one tap. With `onRemove`, a tap takes the food off
// the row instead (editing the favourites).
function FoodChips({ foods, onAdd, onRemove }) {
  const { t, i18n } = useTranslation();
  const kcal = (value) => formatNumber(value, i18n.language, { maxDecimals: 0 });
  return (
    <div className={styles.chips}>
      {foods.map((food) =>
        onRemove ? (
          <button
            type="button"
            key={food.id ?? food.name}
            className={`${styles.chip} ${styles.chipRemove}`}
            aria-label={t("nutrition.removeFavourite", { name: food.name })}
            onClick={() => onRemove(food)}
          >
            <span className={styles.chipName}>{food.name}</span>
            <Icon name="close" size={14} />
          </button>
        ) : (
          <button
            type="button"
            key={food.id ?? food.name}
            className={styles.chip}
            aria-label={t("nutrition.addFoodChip", { name: food.name, kcal: kcal(food.kcal) })}
            onClick={() => onAdd(food)}
          >
            <span className={styles.chipPlus} aria-hidden="true">
              +
            </span>
            <span className={styles.chipName}>{food.name}</span>
            <span className={styles.chipKcal}>{kcal(food.kcal)}</span>
          </button>
        ),
      )}
    </div>
  );
}

/**
 * One meal of the day: its foods, and the ways to add more. A meal offered from an earlier day
 * (`meal.id` null) is not saved until food goes into it. One card at a time is open (`isOpen`)
 * with its food field and one-tap foods; the others show a button that opens them (`onOpen`),
 * which anything done in a card calls too, so it stays the open one.
 *
 * `actions` are the day's own (useNutritionDay): they save a change and resolve to what was
 * saved, or to null when saving failed and the failure has already been reported. `recentFoods`
 * are the one-tap foods for this meal and `searchFoods` what its name field finds besides the
 * favourites. `previous` is the last meal of this name before `date`, when there is one.
 */
function MealCard({
  meal,
  date,
  isOpen,
  onOpen,
  actions,
  favourites,
  recentFoods,
  searchFoods,
  previous,
  onSaveFavourite,
  onDeleteFavourite,
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const nameId = useId();
  const [food, setFood] = useState(EMPTY_FOOD);
  const [isAdding, setIsAdding] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [savePromptFood, setSavePromptFood] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editFood, setEditFood] = useState(EMPTY_FOOD);
  const [isEditingFavourites, setIsEditingFavourites] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const pickerRef = useRef(null);
  const menuRef = useRef(null);
  const nameInputRef = useRef(null);
  // The meal the app once made for food added by name is saved as "Ostalo"; it is shown in the
  // page's language. Meals named by hand are shown as named.
  const mealName = meal.name === DEFAULT_MEAL_NAME ? t("nutrition.defaultMeal") : meal.name;

  useCloseOnOutsidePress(showPicker, pickerRef, setShowPicker);
  useCloseOnOutsidePress(showMenu, menuRef, setShowMenu);

  const pickerRecent = foodsMatching(searchFoods, food.name);
  const pickerFavourites = foodsMatching(favourites, food.name);
  const hasPicks = pickerRecent.length > 0 || pickerFavourites.length > 0;
  const isFavourite = (name) =>
    favourites.some((favourite) => nameKey(favourite.name) === nameKey(name));

  const addChosenFood = (picked) => {
    onOpen();
    return actions.addItemToMeal(meal, picked);
  };

  const addFood = async () => {
    setIsAdding(true);
    const saved = await addChosenFood(food);
    setIsAdding(false);
    if (!saved) return;
    setFood(EMPTY_FOOD);
    setShowPicker(false);
    // Offered with what was saved, so grams left empty are saved as the 0 they became.
    if (!isFavourite(saved.name)) setSavePromptFood(saved);
  };

  const pickFood = (picked) => {
    setFood(formFromFood(picked, language));
    setShowPicker(false);
  };

  const deleteMeal = () => {
    setShowMenu(false);
    if (window.confirm(t("nutrition.confirmDeleteMeal", { name: mealName }))) {
      actions.deleteMeal(meal.id);
    }
  };

  const saveEditing = async (itemId) => {
    if (await actions.updateItem(itemId, editFood)) setEditingItemId(null);
  };

  const kcal = (value) => formatNumber(value, language, { maxDecimals: 0 });
  const grams = (value) => formatNumber(value, language, { maxDecimals: 1 });
  const total = sumMacros(meal.items);
  const hasName = food.name.trim() !== "";

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.heading}>{mealName}</h2>
        <span className={styles.mealKcal}>{`${kcal(total.kcal)} kcal`}</span>
        {meal.id ? (
          <div className={styles.menuWrapper} ref={menuRef}>
            <button
              type="button"
              className={styles.menuButton}
              aria-label={t("nutrition.mealOptions", { name: mealName })}
              aria-expanded={showMenu}
              onClick={() => setShowMenu((prev) => !prev)}
            >
              <Icon name="more" />
            </button>
            {showMenu && (
              <div className={styles.menuDropdown}>
                <button type="button" className={styles.menuItem} onClick={deleteMeal}>
                  {t("nutrition.deleteMeal")}
                </button>
              </div>
            )}
          </div>
        ) : (
          // Nothing to delete yet: the kcal stays where every other card has it.
          <span className={styles.menuSpacer} aria-hidden="true" />
        )}
      </div>

      {meal.items.length > 0 && (
        <ul className={styles.itemList}>
          {meal.items.map((item) =>
            editingItemId === item.id ? (
              <li key={item.id} className={styles.itemEditing}>
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (isComplete(editFood)) saveEditing(item.id);
                  }}
                >
                  <div className={styles.field} data-field="name">
                    <label className={styles.fieldLabel} htmlFor={`${nameId}edit`}>
                      {t("nutrition.foodLabel")}
                    </label>
                    <input
                      id={`${nameId}edit`}
                      className={`${styles.fieldInput} ${styles.nameInput}`}
                      autoComplete="off"
                      value={editFood.name}
                      onChange={(event) => setEditFood({ ...editFood, name: event.target.value })}
                    />
                  </div>
                  <MacroFields values={editFood} onChange={setEditFood} />
                  <div className={styles.editActions}>
                    <button
                      type="submit"
                      className={styles.saveButton}
                      disabled={!isComplete(editFood)}
                    >
                      {t("common.save")}
                    </button>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => setEditingItemId(null)}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={item.id} className={styles.itemRow}>
                <button
                  type="button"
                  className={styles.itemText}
                  title={t("nutrition.editItem")}
                  onClick={() => {
                    setEditingItemId(item.id);
                    setEditFood(formFromFood(item, language));
                  }}
                >
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemDetail}>
                    {t("nutrition.itemDetail", {
                      kcal: kcal(item.kcal),
                      protein: grams(item.protein),
                      carbs: grams(item.carbs),
                      fat: grams(item.fat),
                    })}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={t("nutrition.deleteItem")}
                  title={t("nutrition.deleteItem")}
                  onClick={() => actions.deleteItem(item.id)}
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {meal.items.length === 0 && previous && (
        <PreviousMeal
          previous={previous}
          date={date}
          onCopy={(last) => {
            onOpen();
            return actions.copyMeal(last);
          }}
        />
      )}

      {savePromptFood && (
        <div className={styles.savePrompt}>
          <span className={styles.savePromptText}>
            {t("nutrition.saveAsFoodPrompt", { name: savePromptFood.name })}
          </span>
          <button
            type="button"
            className={styles.savePromptYes}
            onClick={() => {
              const { name, kcal: foodKcal, protein, carbs, fat } = savePromptFood;
              onSaveFavourite({ name, kcal: foodKcal, protein, carbs, fat });
              setSavePromptFood(null);
            }}
          >
            {t("common.yes")}
          </button>
          <button
            type="button"
            className={styles.savePromptNo}
            onClick={() => setSavePromptFood(null)}
          >
            {t("common.no")}
          </button>
        </div>
      )}

      {!isOpen && (
        <button type="button" className={styles.openButton} onClick={onOpen}>
          <Icon name="plus" size={18} />
          {t("nutrition.addItem")}
        </button>
      )}

      {isOpen && (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (isComplete(food) && !isAdding) addFood();
          }}
        >
          <div className={`${styles.field} ${styles.nameField}`} data-field="name" ref={pickerRef}>
            <label className={styles.fieldLabel} htmlFor={`${nameId}add`}>
              {t("nutrition.foodLabel")}
            </label>
            <div className={styles.nameRow}>
              <input
                ref={nameInputRef}
                id={`${nameId}add`}
                className={`${styles.fieldInput} ${styles.nameInput}`}
                placeholder={t("nutrition.foodNamePlaceholder")}
                autoComplete="off"
                value={food.name}
                onChange={(event) => {
                  setFood({ ...food, name: event.target.value });
                  setShowPicker(true);
                }}
                onFocus={() => setShowPicker(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setShowPicker(false);
                }}
              />
              <button
                type="button"
                className={styles.scanButton}
                aria-label={t("scanner.open")}
                title={t("scanner.open")}
                onClick={() => {
                  setShowPicker(false);
                  setIsScanning(true);
                }}
              >
                <Icon name="barcode" size={22} />
              </button>
            </div>
            {showPicker && hasPicks && (
              <div className={styles.picker}>
                {pickerRecent.length > 0 && (
                  <div className={styles.pickerSection}>{t("nutrition.recentItems")}</div>
                )}
                {pickerRecent.map((option) => (
                  <button
                    type="button"
                    key={`recent-${option.name}`}
                    className={styles.pickerOption}
                    onClick={() => pickFood(option)}
                  >
                    {option.name}
                    <span className={styles.pickerKcal}>{`${kcal(option.kcal)} kcal`}</span>
                  </button>
                ))}
                {pickerFavourites.length > 0 && (
                  <div className={styles.pickerSection}>{t("nutrition.savedItems")}</div>
                )}
                {pickerFavourites.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={styles.pickerOption}
                    onClick={() => pickFood(option)}
                  >
                    {option.name}
                    <span className={styles.pickerKcal}>{`${kcal(option.kcal)} kcal`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* The numbers are asked for once there is a food to give them for. */}
          {hasName && (
            <>
              <MacroFields values={food} onChange={setFood} />
              <button
                type="submit"
                data-action="add-food"
                className={styles.addButton}
                disabled={!isComplete(food) || isAdding}
              >
                {t("nutrition.addItem")}
              </button>
            </>
          )}
        </form>
      )}

      {isOpen && recentFoods.length > 0 && (
        <div className={styles.chipGroup}>
          <span className={styles.chipLabel}>{t("nutrition.recentItems")}</span>
          <FoodChips foods={recentFoods} onAdd={addChosenFood} />
        </div>
      )}

      {isOpen && favourites.length > 0 && (
        <div className={styles.chipGroup}>
          <div className={styles.chipHeader}>
            <span className={styles.chipLabel}>
              <span className={styles.star}>
                <Icon name="star" size={14} />
              </span>
              {t("nutrition.savedItems")}
            </span>
            <button
              type="button"
              className={styles.chipEdit}
              aria-pressed={isEditingFavourites}
              onClick={() => setIsEditingFavourites((editing) => !editing)}
            >
              {isEditingFavourites ? t("nutrition.doneEditing") : t("nutrition.editFavourites")}
            </button>
          </div>
          <FoodChips
            foods={favourites}
            onAdd={addChosenFood}
            onRemove={
              isEditingFavourites
                ? (favourite) => {
                    // Without favourites the row goes, and so does editing it.
                    if (favourites.length === 1) setIsEditingFavourites(false);
                    onDeleteFavourite(favourite);
                  }
                : undefined
            }
          />
        </div>
      )}

      {isScanning && (
        <BarcodeScanner
          mealName={mealName}
          onClose={() => setIsScanning(false)}
          onAdd={addChosenFood}
          onTypeFood={() => {
            setIsScanning(false);
            // After the scanner has given focus back to its button.
            requestAnimationFrame(() => nameInputRef.current?.focus());
          }}
          isFavourite={isFavourite}
          onSaveFavourite={onSaveFavourite}
        />
      )}
    </section>
  );
}

export default MealCard;
