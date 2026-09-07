import { useState, useRef, useEffect } from "react";
import { fetchJson } from "../api";
import styles from "./MealCard.module.css";

const EMPTY_FOOD_ITEM = { name: "", kcal: "", protein: "", carbs: "", fat: "" };

function foodItemToFormValues(item) {
  return {
    name: item.name,
    kcal: String(item.kcal),
    protein: String(item.protein),
    carbs: String(item.carbs),
    fat: String(item.fat),
  };
}

function MealCard({ meal, foodItemTemplates, onAddItem, onUpdateItem, onDeleteItem, onDeleteMeal, onSaveTemplate }) {
  const [foodItem, setFoodItem] = useState(EMPTY_FOOD_ITEM);
  const [showPicker, setShowPicker] = useState(false);
  const [savePromptItem, setSavePromptItem] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItem, setEditItem] = useState(EMPTY_FOOD_ITEM);
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

  const filteredTemplates = foodItem.name.trim()
    ? foodItemTemplates.filter((template) =>
        template.name.toLowerCase().includes(foodItem.name.trim().toLowerCase()),
      )
    : foodItemTemplates;

  const selectTemplate = (template) => {
    setFoodItem(foodItemToFormValues(template));
    setShowPicker(false);
  };

  const addItem = () => {
    if (!foodItem.name.trim()) return;

    const isKnown = foodItemTemplates.some(
      (template) => template.name.toLowerCase() === foodItem.name.trim().toLowerCase(),
    );

    fetchJson(`/api/nutrition/meals/${meal.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(foodItem),
    })
      .then((data) => {
        onAddItem(data);
        if (!isKnown) {
          setSavePromptItem({ ...foodItem, name: foodItem.name.trim() });
        }
        setFoodItem(EMPTY_FOOD_ITEM);
        setShowPicker(false);
      })
      .catch((err) => console.error(err));
  };

  const deleteItem = (itemId) => {
    fetchJson(`/api/nutrition/items/${itemId}`, { method: "DELETE" })
      .then(() => onDeleteItem(itemId))
      .catch((err) => console.error(err));
  };

  const deleteMeal = () => {
    setShowMenu(false);
    if (!window.confirm(`Obrisati obrok "${meal.name}" i sve njegove namirnice?`)) {
      return;
    }
    fetchJson(`/api/nutrition/meals/${meal.id}`, { method: "DELETE" })
      .then(() => onDeleteMeal(meal.id))
      .catch((err) => console.error(err));
  };

  const startEditingItem = (item) => {
    setEditingItemId(item.id);
    setEditItem(foodItemToFormValues(item));
  };

  const saveEditingItem = (itemId) => {
    fetchJson(`/api/nutrition/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editItem),
    })
      .then((data) => {
        onUpdateItem(data);
        setEditingItemId(null);
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.heading}>{meal.name}</h3>
        <div className={styles.menuWrapper} ref={menuRef}>
          <button className={styles.menuButton} onClick={() => setShowMenu((prev) => !prev)}>
            ⋮
          </button>
          {showMenu && (
            <div className={styles.menuDropdown}>
              <button className={styles.menuItem} onClick={deleteMeal}>
                Obriši obrok
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.itemInputRow} style={{ position: "relative" }} ref={pickerRef}>
        <input
          type="text"
          className={styles.itemNameInput}
          placeholder="Naziv hrane"
          value={foodItem.name}
          onChange={(event) => {
            setFoodItem((prev) => ({ ...prev, name: event.target.value }));
            setShowPicker(true);
          }}
          onFocus={() => setShowPicker(true)}
        />
        <input
          type="number"
          className={styles.itemInput}
          placeholder="kcal"
          value={foodItem.kcal}
          onChange={(event) => setFoodItem((prev) => ({ ...prev, kcal: event.target.value }))}
        />
        <input
          type="number"
          className={styles.itemInput}
          placeholder="protein"
          value={foodItem.protein}
          onChange={(event) => setFoodItem((prev) => ({ ...prev, protein: event.target.value }))}
        />
        <input
          type="number"
          className={styles.itemInput}
          placeholder="carbs"
          value={foodItem.carbs}
          onChange={(event) => setFoodItem((prev) => ({ ...prev, carbs: event.target.value }))}
        />
        <input
          type="number"
          className={styles.itemInput}
          placeholder="fat"
          value={foodItem.fat}
          onChange={(event) => setFoodItem((prev) => ({ ...prev, fat: event.target.value }))}
        />
        <button className={styles.addItemButton} onClick={addItem}>
          Dodaj
        </button>

        {showPicker && filteredTemplates.length > 0 && (
          <div className={styles.itemPicker}>
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                className={styles.itemPickerOption}
                onClick={() => selectTemplate(template)}
              >
                {template.name}
                <span className={styles.itemPickerMacros}>{template.kcal} kcal</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {savePromptItem && (
        <div className={styles.savePrompt}>
          <span className={styles.savePromptText}>
            Spremi "{savePromptItem.name}" kao namirnicu?
          </span>
          <button
            className={styles.savePromptYes}
            onClick={() => {
              onSaveTemplate(savePromptItem);
              setSavePromptItem(null);
            }}
          >
            Da
          </button>
          <button className={styles.savePromptNo} onClick={() => setSavePromptItem(null)}>
            Ne
          </button>
        </div>
      )}

      <div className={styles.itemList}>
        {meal.items?.map((item) =>
          editingItemId === item.id ? (
            <div key={item.id} className={styles.itemRowEditing}>
              <input
                type="text"
                className={styles.itemNameInput}
                value={editItem.name}
                onChange={(event) => setEditItem((prev) => ({ ...prev, name: event.target.value }))}
              />
              <input
                type="number"
                className={styles.itemInput}
                value={editItem.kcal}
                onChange={(event) => setEditItem((prev) => ({ ...prev, kcal: event.target.value }))}
              />
              <input
                type="number"
                className={styles.itemInput}
                value={editItem.protein}
                onChange={(event) => setEditItem((prev) => ({ ...prev, protein: event.target.value }))}
              />
              <input
                type="number"
                className={styles.itemInput}
                value={editItem.carbs}
                onChange={(event) => setEditItem((prev) => ({ ...prev, carbs: event.target.value }))}
              />
              <input
                type="number"
                className={styles.itemInput}
                value={editItem.fat}
                onChange={(event) => setEditItem((prev) => ({ ...prev, fat: event.target.value }))}
              />
              <button className={styles.saveItemButton} onClick={() => saveEditingItem(item.id)}>
                Spremi
              </button>
              <button className={styles.cancelItemButton} onClick={() => setEditingItemId(null)}>
                Odustani
              </button>
            </div>
          ) : (
            <div key={item.id} className={styles.itemRow}>
              <span className={styles.itemText} onClick={() => startEditingItem(item)}>
                {item.name} — {item.kcal} kcal — {item.protein}p / {item.carbs}c / {item.fat}f
              </span>
              <button className={styles.deleteItem} onClick={() => deleteItem(item.id)}>
                X
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export default MealCard;
