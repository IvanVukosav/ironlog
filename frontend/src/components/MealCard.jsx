import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatNumber, toInputText } from "../utils/numbers";
import { sumMacros } from "../utils/nutritionState";
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
const isSameName = (nameA, nameB) => nameA.trim().toLowerCase() === nameB.trim().toLowerCase();

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

// `actions` are the day's own (useNutritionDay): they save a change and resolve to what was
// saved, or to null when saving failed and the failure has already been reported.
function MealCard({ meal, actions, foodItemTemplates, onSaveTemplate }) {
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
  const pickerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showPicker) return undefined;
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  useEffect(() => {
    if (!showMenu) return undefined;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const query = food.name.trim().toLowerCase();
  const filteredTemplates = query
    ? foodItemTemplates.filter((template) => template.name.toLowerCase().includes(query))
    : foodItemTemplates;

  const addFood = async () => {
    setIsAdding(true);
    const isKnown = foodItemTemplates.some((template) => isSameName(template.name, food.name));
    const saved = await actions.addItem(meal.id, food);
    setIsAdding(false);
    if (!saved) return;
    setFood(EMPTY_FOOD);
    setShowPicker(false);
    // Offered with what was saved, so grams left empty are saved as the 0 they became.
    if (!isKnown) setSavePromptFood(saved);
  };

  const deleteMeal = () => {
    setShowMenu(false);
    if (window.confirm(t("nutrition.confirmDeleteMeal", { name: meal.name }))) {
      actions.deleteMeal(meal.id);
    }
  };

  const saveEditing = async (itemId) => {
    if (await actions.updateItem(itemId, editFood)) setEditingItemId(null);
  };

  const kcal = (value) => formatNumber(value, language, { maxDecimals: 0 });
  const grams = (value) => formatNumber(value, language, { maxDecimals: 1 });
  const total = sumMacros(meal.items);

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.heading}>{meal.name}</h2>
        <span className={styles.mealKcal}>{`${kcal(total.kcal)} kcal`}</span>
        <div className={styles.menuWrapper} ref={menuRef}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label={t("nutrition.mealOptions", { name: meal.name })}
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
              onSaveTemplate({ name, kcal: foodKcal, protein, carbs, fat });
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
          <input
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
          {showPicker && filteredTemplates.length > 0 && (
            <div className={styles.picker}>
              {filteredTemplates.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  className={styles.pickerOption}
                  onClick={() => {
                    setFood(formFromFood(template, language));
                    setShowPicker(false);
                  }}
                >
                  {template.name}
                  <span className={styles.pickerKcal}>{`${kcal(template.kcal)} kcal`}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <MacroFields values={food} onChange={setFood} />
        <button
          type="submit"
          data-action="add-food"
          className={styles.addButton}
          disabled={!isComplete(food) || isAdding}
        >
          {t("nutrition.addItem")}
        </button>
      </form>
    </section>
  );
}

export default MealCard;
