import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ExerciseCard from "../components/ExerciseCard";
import DatePicker from "../components/DatePicker";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import { useDragReorder } from "../hooks/useDragReorder";
import styles from "./Log.module.css";

const MUSCLE_GROUPS = [
  "Leđa", "Prsa", "Kvadriceps", "Stražnja loža", "Ramena", "Gluteus", "Ruke", "Trbušnjaci",
];
const ALL_MUSCLE_GROUPS_FILTER = "Sve";

function Log() {
  const { t } = useTranslation();
  const { showError } = useToast();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(
    searchParams.get("date") || new Date().toISOString().split("T")[0],
  );
  const [workout, setWorkout] = useState(null);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseTemplates, setExerciseTemplates] = useState([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [savePromptName, setSavePromptName] = useState(null);
  const [savePromptMuscleGroup, setSavePromptMuscleGroup] = useState("");
  const [muscleGroupFilter, setMuscleGroupFilter] = useState(ALL_MUSCLE_GROUPS_FILTER);
  const [settings, setSettings] = useState(null);
  const [workoutTemplates, setWorkoutTemplates] = useState([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState(null);
  const exercisePickerRef = useRef(null);
  const templatePickerRef = useRef(null);
  const pickerMode = settings?.exercisePickerMode ?? "chips";

  const { draggedId: draggedExerciseId, hoveredId: hoveredExerciseId, startDrag: startExerciseDrag } = useDragReorder(
    workout?.exercises || [],
    (newExercises) => {
      setWorkout((prev) => ({ ...prev, exercises: newExercises }));
      fetchJson(`/api/workouts/${workout.id}/exercises/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseIds: newExercises.map((exercise) => exercise.id) }),
      }).catch((err) => {
        console.error(err);
        showError(err.message);
      });
    },
  );

  useEffect(() => {
    fetchJson(`/api/workouts?date=${date}`)
      .then((data) => setWorkout(data[0] || null))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson("/api/exercise-templates")
      .then((data) => setExerciseTemplates(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [date, showError]);

  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson("/api/workout-templates")
      .then((data) => setWorkoutTemplates(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [showError]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exercisePickerRef.current && !exercisePickerRef.current.contains(event.target)) {
        setShowExercisePicker(false);
      }
      if (templatePickerRef.current && !templatePickerRef.current.contains(event.target)) {
        setShowTemplatePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createWorkout = () => {
    fetchJson("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((data) => setWorkout(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const cancelWorkout = () => {
    if (!workout) return;
    if (!window.confirm(t("log.confirmCancelWorkout"))) {
      return;
    }
    fetchJson(`/api/workouts/${workout.id}`, { method: "DELETE" })
      .then(() => setWorkout(null))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const addExercise = () => {
    if (!exerciseName.trim()) return;

    const isKnown = exerciseTemplates.some(
      (template) => template.name.toLowerCase() === exerciseName.trim().toLowerCase()
    );
    if (!isKnown) {
      setSavePromptName(exerciseName.trim());
    }

    const alreadyInWorkout = workout.exercises?.some(
      (exercise) => exercise.name.toLowerCase() === exerciseName.trim().toLowerCase()
    );
    if (alreadyInWorkout) {
      showError(t("log.exerciseAlreadyAdded", { name: exerciseName.trim() }));
      return;
    }

    fetchJson(`/api/workouts/${workout.id}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: exerciseName }),
    })
      .then((data) => {
        setWorkout((prev) => ({
          ...prev,
          exercises: [...(prev.exercises || []), { ...data, sets: [] }],
        }));
        setExerciseName("");
        setShowExercisePicker(false);
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const updateWorkoutName = (name) => {
    if (!workout) return;
    fetchJson(`/api/workouts/${workout.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then((data) => setWorkout((prev) => ({ ...prev, name: data.name })))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const saveExerciseTemplate = (name, muscleGroup) => {
    if (!muscleGroup) return;
    fetchJson("/api/exercise-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, muscleGroup }),
    })
      .then((data) => {
        setExerciseTemplates((prev) => [...prev, data].sort((templateA, templateB) => templateA.name.localeCompare(templateB.name)));
        setSavePromptName(null);
        setSavePromptMuscleGroup("");
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const saveWorkoutTemplate = () => {
    if (!saveTemplateName || !saveTemplateName.trim() || !workout) return;
    fetchJson("/api/workout-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: saveTemplateName.trim(),
        exercises: workout.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets.map((set) => ({
            weight: set.weight,
            reps: set.reps,
            rpe: set.rpe,
          })),
        })),
      }),
    })
      .then((data) => {
        setWorkoutTemplates((prev) =>
          [...prev, data].sort((templateA, templateB) => templateA.name.localeCompare(templateB.name)),
        );
        setSaveTemplateName(null);
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const applyWorkoutTemplate = (templateId) => {
    fetchJson(`/api/workout-templates/${templateId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workoutId: workout.id }),
    })
      .then((createdExercises) => {
        setWorkout((prev) => ({
          ...prev,
          exercises: [...(prev.exercises || []), ...createdExercises],
        }));
        setShowTemplatePicker(false);
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const deleteWorkoutTemplate = (templateId) => {
    fetchJson(`/api/workout-templates/${templateId}`, { method: "DELETE" })
      .then(() =>
        setWorkoutTemplates((prev) => prev.filter((template) => template.id !== templateId)),
      )
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const removeExerciseTemplate = (id) => {
    fetchJson(`/api/exercise-templates/${id}`, { method: "DELETE" })
      .then(() => setExerciseTemplates((prev) => prev.filter((template) => template.id !== id)))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const filteredTemplates = exerciseTemplates.filter((template) => {
    const matchesSearch = !exerciseName.trim()
      || template.name.toLowerCase().includes(exerciseName.trim().toLowerCase());
    const matchesGroup = muscleGroupFilter === ALL_MUSCLE_GROUPS_FILTER
      || template.muscleGroup === muscleGroupFilter;
    return matchesSearch && matchesGroup;
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("log.title")}</h1>

      <div className={styles.topRow}>
        <DatePicker value={date} onChange={setDate} />
        {workout && (
          <>
            <span className={styles.meta}>{t("log.workoutId", { id: workout.id })}</span>
            <button className={styles.cancelButton} onClick={cancelWorkout}>
              {t("common.cancel")}
            </button>
            {workout.exercises?.length > 0 && (
              <button
                className={styles.cancelButton}
                onClick={() => setSaveTemplateName("")}
              >
                {t("log.saveAsTemplate")}
              </button>
            )}
          </>
        )}
      </div>

      {saveTemplateName !== null && (
        <div className={styles.savePrompt}>
          <span className={styles.savePromptText}>{t("log.templateNameLabel")}</span>
          <input
            type="text"
            className={styles.savePromptSelect}
            autoFocus
            value={saveTemplateName}
            onChange={(event) => setSaveTemplateName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveWorkoutTemplate();
              if (event.key === "Escape") setSaveTemplateName(null);
            }}
          />
          <button
            className={styles.savePromptYes}
            disabled={!saveTemplateName.trim()}
            onClick={saveWorkoutTemplate}
          >
            {t("common.save")}
          </button>
          <button className={styles.savePromptNo} onClick={() => setSaveTemplateName(null)}>
            {t("common.no")}
          </button>
        </div>
      )}

      {workout && (
        <input
          type="text"
          className={styles.workoutNameInput}
          placeholder={t("log.workoutNamePlaceholder")}
          defaultValue={workout.name || ""}
          onBlur={(event) => updateWorkoutName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.target.blur();
          }}
        />
      )}

      {!workout && (
        <button className={styles.startButton} onClick={createWorkout}>
          {t("log.startWorkout")}
        </button>
      )}

      {workout && (
        <div>
          <div className={styles.addRow} style={{ position: "relative" }} ref={exercisePickerRef}>
            <input
              type="text"
              className={styles.exerciseInput}
              placeholder={t("log.searchOrTypeExercise")}
              value={exerciseName}
              onChange={(event) => {
                setExerciseName(event.target.value);
                setShowExercisePicker(true);
                setSavePromptName(null);
              }}
              onFocus={() => setShowExercisePicker(true)}
            />
            <button className={styles.addButton} onClick={addExercise}>
              {t("log.addExercise")}
            </button>
            {workoutTemplates.length > 0 && (
              <div style={{ position: "relative", display: "inline-block" }} ref={templatePickerRef}>
                <button
                  className={styles.addButton}
                  onClick={() => setShowTemplatePicker((prev) => !prev)}
                >
                  {t("log.loadTemplate")}
                </button>
                {showTemplatePicker && (
                  <div className={styles.exercisePicker}>
                    {workoutTemplates.map((template) => (
                      <div key={template.id} className={styles.exercisePickerItem}>
                        <button
                          className={styles.exercisePickerName}
                          onClick={() => applyWorkoutTemplate(template.id)}
                        >
                          {template.name}
                          <span className={styles.exercisePickerGroup}>
                            {template.exercises.length} {t("log.exercisesSuffix")}
                          </span>
                        </button>
                        <button
                          className={styles.exercisePickerRemove}
                          onClick={() => deleteWorkoutTemplate(template.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showExercisePicker && (
              <div className={styles.exercisePicker}>
                {pickerMode === "chips" && (
                  <div className={styles.muscleGroupChips}>
                    {[ALL_MUSCLE_GROUPS_FILTER, ...MUSCLE_GROUPS].map((group) => (
                      <button
                        key={group}
                        className={muscleGroupFilter === group ? styles.muscleGroupChipActive : styles.muscleGroupChip}
                        onClick={() => setMuscleGroupFilter(group)}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                )}

                {pickerMode === "twoStep" && !exerciseName.trim() && muscleGroupFilter === ALL_MUSCLE_GROUPS_FILTER && (
                  <div className={styles.categoryList}>
                    {MUSCLE_GROUPS.map((group) => (
                      <button
                        key={group}
                        className={styles.categoryListItem}
                        onClick={() => setMuscleGroupFilter(group)}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                )}

                {pickerMode === "twoStep" && !exerciseName.trim() && muscleGroupFilter !== ALL_MUSCLE_GROUPS_FILTER && (
                  <button
                    className={styles.backButton}
                    onClick={() => setMuscleGroupFilter(ALL_MUSCLE_GROUPS_FILTER)}
                  >
                    {t("log.back")}
                  </button>
                )}

                {(pickerMode === "chips" || exerciseName.trim() || muscleGroupFilter !== ALL_MUSCLE_GROUPS_FILTER) && (
                  <>
                    {filteredTemplates.map((template) => (
                      <div key={template.id} className={styles.exercisePickerItem}>
                        <button
                          className={styles.exercisePickerName}
                          onClick={() => {
                            setExerciseName(template.name);
                            setShowExercisePicker(false);
                          }}
                        >
                          {template.name}
                          {template.muscleGroup && (
                            <span className={styles.exercisePickerGroup}>{template.muscleGroup}</span>
                          )}
                        </button>
                        <button
                          className={styles.exercisePickerRemove}
                          onClick={() => removeExerciseTemplate(template.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {exerciseName.trim() && !exerciseTemplates.some((template) => template.name.toLowerCase() === exerciseName.trim().toLowerCase()) && (
                      <button
                        type="button"
                        className={styles.exercisePickerCustom}
                        onClick={addExercise}
                      >
                        {t("log.addAsExercise", { name: exerciseName.trim() })}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          {savePromptName && (
            <div className={styles.savePrompt}>
              <span className={styles.savePromptText}>
                {t("log.savePromptExercise", { name: savePromptName })}
              </span>
              <select
                className={styles.savePromptSelect}
                value={savePromptMuscleGroup}
                onChange={(event) => setSavePromptMuscleGroup(event.target.value)}
              >
                <option value="">{t("log.muscleGroupPlaceholder")}</option>
                {MUSCLE_GROUPS.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
              <button
                className={styles.savePromptYes}
                disabled={!savePromptMuscleGroup}
                onClick={() => saveExerciseTemplate(savePromptName, savePromptMuscleGroup)}
              >
                {t("common.save")}
              </button>
              <button
                className={styles.savePromptNo}
                onClick={() => {
                  setSavePromptName(null);
                  setSavePromptMuscleGroup("");
                }}
              >
                {t("common.no")}
              </button>
            </div>
          )}

          <div className={styles.cardList}>
            {workout.exercises?.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                showE1rm={settings?.showE1rm ?? true}
                e1rmFormula={settings?.e1rmFormula ?? "brzycki"}
                isDragging={draggedExerciseId === exercise.id}
                isDropTarget={hoveredExerciseId === String(exercise.id) && draggedExerciseId !== exercise.id}
                onDragHandlePointerDown={() => startExerciseDrag(exercise.id)}
                onDeleteSet={(setId) =>
                  setWorkout((prev) => ({
                    ...prev,
                    exercises: prev.exercises.map((currentExercise) =>
                      currentExercise.id === exercise.id
                        ? {
                            ...currentExercise,
                            sets: currentExercise.sets.filter(
                              (currentSet) => currentSet.id !== setId,
                            ),
                          }
                        : currentExercise,
                    ),
                  }))
                }
                onAddSet={(data) =>
                  setWorkout((prev) => ({
                    ...prev,
                    exercises: prev.exercises.map((currentExercise) =>
                      currentExercise.id === exercise.id
                        ? {
                            ...currentExercise,
                            sets: [...(currentExercise.sets || []), data],
                          }
                        : currentExercise,
                    ),
                  }))
                }
                onUpdateSet={(updatedSet) =>
                  setWorkout((prev) => ({
                    ...prev,
                    exercises: prev.exercises.map((currentExercise) =>
                      currentExercise.id === exercise.id
                        ? {
                            ...currentExercise,
                            sets: currentExercise.sets.map((currentSet) =>
                              currentSet.id === updatedSet.id ? updatedSet : currentSet,
                            ),
                          }
                        : currentExercise,
                    ),
                  }))
                }
                onUpdateExercise={(updatedExercise) =>
                  setWorkout((prev) => ({
                    ...prev,
                    exercises: prev.exercises.map((currentExercise) =>
                      currentExercise.id === updatedExercise.id
                        ? { ...currentExercise, supersetGroup: updatedExercise.supersetGroup }
                        : currentExercise,
                    ),
                  }))
                }
                onDeleteExercise={(exerciseId) =>
                  setWorkout((prev) => ({
                    ...prev,
                    exercises: prev.exercises.filter(
                      (currentExercise) => currentExercise.id !== exerciseId,
                    ),
                  }))
                }
                onReorderSets={(newSets) =>
                  setWorkout((prev) => ({
                    ...prev,
                    exercises: prev.exercises.map((currentExercise) =>
                      currentExercise.id === exercise.id
                        ? { ...currentExercise, sets: newSets }
                        : currentExercise,
                    ),
                  }))
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Log;
