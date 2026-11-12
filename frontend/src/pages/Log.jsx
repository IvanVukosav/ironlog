import { Fragment, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ExerciseCard from "../components/ExerciseCard";
import DatePicker from "../components/DatePicker";
import ProgramLoader from "../components/ProgramLoader";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import { useSettings } from "../context/useSettings";
import { useDragReorder } from "../hooks/useDragReorder";
import { useReportError } from "../hooks/useReportError";
import { DEFAULT_E1RM_FORMULA } from "../utils/oneRepMax";
import { todayKey } from "../utils/dates";
import styles from "./Log.module.css";

const MUSCLE_GROUPS = [
  "Leđa",
  "Prsa",
  "Kvadriceps",
  "Stražnja loža",
  "Ramena",
  "Gluteus",
  "Ruke",
  "Trbušnjaci",
];
const ALL_MUSCLE_GROUPS_FILTER = "Sve";
const SUPERSET_COLORS = ["#3ba7ff", "#3ec95c", "#ffb020", "#c678dd", "#ff6b9d"];

function Log() {
  const { t } = useTranslation();
  const { showError } = useToast();
  const reportError = useReportError();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || todayKey());
  const [workout, setWorkout] = useState(null);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseTemplates, setExerciseTemplates] = useState([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [savePromptName, setSavePromptName] = useState(null);
  const [savePromptMuscleGroup, setSavePromptMuscleGroup] = useState("");
  const [muscleGroupFilter, setMuscleGroupFilter] = useState(ALL_MUSCLE_GROUPS_FILTER);
  const { settings } = useSettings();
  const [workoutTemplates, setWorkoutTemplates] = useState([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [showProgramLoader, setShowProgramLoader] = useState(false);
  const exercisePickerRef = useRef(null);
  const templatePickerRef = useRef(null);
  const pickerMode = settings?.exercisePickerMode ?? "chips";

  const exerciseDrag = useDragReorder(workout?.exercises || [], (newExercises) => {
    setWorkout((prev) => ({ ...prev, exercises: newExercises }));
    fetchJson(`/api/workouts/${workout.id}/exercises/reorder`, {
      method: "PATCH",
      json: { exerciseIds: newExercises.map((exercise) => exercise.id) },
    }).catch(reportError);
  });

  useEffect(() => {
    fetchJson(`/api/workouts?date=${date}`)
      .then((data) => setWorkout(data[0] || null))
      .catch(reportError);

    fetchJson("/api/exercise-templates").then(setExerciseTemplates).catch(reportError);
  }, [date, reportError]);

  useEffect(() => {
    fetchJson("/api/workout-templates").then(setWorkoutTemplates).catch(reportError);

    fetchJson("/api/programs").then(setPrograms).catch(reportError);
  }, [reportError]);

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
      json: { date },
    })
      .then(setWorkout)
      .catch(reportError);
  };

  const cancelWorkout = () => {
    if (!workout) return;
    if (!window.confirm(t("log.confirmCancelWorkout"))) {
      return;
    }
    fetchJson(`/api/workouts/${workout.id}`, { method: "DELETE" })
      .then(() => setWorkout(null))
      .catch(reportError);
  };

  const addExercise = () => {
    if (!exerciseName.trim()) return;

    const isKnown = exerciseTemplates.some(
      (template) => template.name.toLowerCase() === exerciseName.trim().toLowerCase(),
    );
    if (!isKnown) {
      setSavePromptName(exerciseName.trim());
    }

    const alreadyInWorkout = workout.exercises?.some(
      (exercise) => exercise.name.toLowerCase() === exerciseName.trim().toLowerCase(),
    );
    if (alreadyInWorkout) {
      showError(t("log.exerciseAlreadyAdded", { name: exerciseName.trim() }));
      return;
    }

    fetchJson(`/api/workouts/${workout.id}/exercises`, {
      method: "POST",
      json: { name: exerciseName },
    })
      .then((data) => {
        setWorkout((prev) => ({
          ...prev,
          exercises: [...(prev.exercises || []), { ...data, sets: [] }],
        }));
        setExerciseName("");
        setShowExercisePicker(false);
      })
      .catch(reportError);
  };

  const updateWorkoutName = (name) => {
    if (!workout || name.trim() === (workout.name || "")) return;
    fetchJson(`/api/workouts/${workout.id}`, {
      method: "PATCH",
      json: { name },
    })
      .then((data) => setWorkout((prev) => ({ ...prev, name: data.name })))
      .catch(reportError);
  };

  const updateWorkoutNotes = (notes) => {
    if (!workout || notes.trim() === (workout.notes || "")) return;
    fetchJson(`/api/workouts/${workout.id}`, {
      method: "PATCH",
      json: { notes },
    })
      .then((data) => setWorkout((prev) => ({ ...prev, notes: data.notes })))
      .catch(reportError);
  };

  const saveExerciseTemplate = (name, muscleGroup) => {
    if (!muscleGroup) return;
    fetchJson("/api/exercise-templates", {
      method: "POST",
      json: { name, muscleGroup },
    })
      .then((data) => {
        setExerciseTemplates((prev) =>
          [...prev, data].sort((templateA, templateB) =>
            templateA.name.localeCompare(templateB.name),
          ),
        );
        setSavePromptName(null);
        setSavePromptMuscleGroup("");
      })
      .catch(reportError);
  };

  const saveWorkoutTemplate = () => {
    if (!saveTemplateName || !saveTemplateName.trim() || !workout) return;
    fetchJson("/api/workout-templates", {
      method: "POST",
      json: {
        name: saveTemplateName.trim(),
        exercises: workout.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets.map((set) => ({
            weight: set.weight,
            reps: set.reps,
            rpe: set.rpe,
          })),
        })),
      },
    })
      .then((data) => {
        setWorkoutTemplates((prev) =>
          [...prev, data].sort((templateA, templateB) =>
            templateA.name.localeCompare(templateB.name),
          ),
        );
        setSaveTemplateName(null);
      })
      .catch(reportError);
  };

  const applyWorkoutTemplate = (templateId) => {
    fetchJson(`/api/workout-templates/${templateId}/apply`, {
      method: "POST",
      json: { workoutId: workout.id },
    })
      .then((createdExercises) => {
        setWorkout((prev) => ({
          ...prev,
          exercises: [...(prev.exercises || []), ...createdExercises],
        }));
        setShowTemplatePicker(false);
      })
      .catch(reportError);
  };

  const deleteWorkoutTemplate = (templateId) => {
    fetchJson(`/api/workout-templates/${templateId}`, { method: "DELETE" })
      .then(() =>
        setWorkoutTemplates((prev) => prev.filter((template) => template.id !== templateId)),
      )
      .catch(reportError);
  };

  const removeExerciseTemplate = (id) => {
    fetchJson(`/api/exercise-templates/${id}`, { method: "DELETE" })
      .then(() => setExerciseTemplates((prev) => prev.filter((template) => template.id !== id)))
      .catch(reportError);
  };

  const filteredTemplates = exerciseTemplates.filter((template) => {
    const matchesSearch =
      !exerciseName.trim() ||
      template.name.toLowerCase().includes(exerciseName.trim().toLowerCase());
    const matchesGroup =
      muscleGroupFilter === ALL_MUSCLE_GROUPS_FILTER || template.muscleGroup === muscleGroupFilter;
    return matchesSearch && matchesGroup;
  });

  const workoutProgram = workout?.programId
    ? programs.find((program) => program.id === workout.programId)
    : null;

  const supersetGroups = [
    ...new Set(
      (workout?.exercises || []).map((exercise) => exercise.supersetGroup).filter(Boolean),
    ),
  ];
  const supersetColorByGroup = Object.fromEntries(
    supersetGroups.map((group, index) => [group, SUPERSET_COLORS[index % SUPERSET_COLORS.length]]),
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("log.title")}</h1>

      <div className={styles.topRow}>
        <DatePicker value={date} onChange={setDate} />
        {workout && (
          <>
            <span className={styles.meta}>{t("log.workoutId", { id: workout.id })}</span>
            {workoutProgram && (
              <span className={styles.meta}>
                {t("log.programTag", {
                  name: workoutProgram.name,
                  week: workout.programWeek,
                  day: workout.programDay,
                })}
              </span>
            )}
            <button className={styles.cancelButton} onClick={cancelWorkout}>
              {t("common.cancel")}
            </button>
            {workout.exercises?.length > 0 && (
              <button className={styles.cancelButton} onClick={() => setSaveTemplateName("")}>
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
        // Both boxes are uncontrolled: the key is what makes them show the next day's workout.
        <Fragment key={workout.id}>
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
          <textarea
            className={styles.workoutNotesInput}
            placeholder={t("log.workoutNotesPlaceholder")}
            rows={2}
            defaultValue={workout.notes || ""}
            onBlur={(event) => updateWorkoutNotes(event.target.value)}
          />
        </Fragment>
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
              <div
                style={{ position: "relative", display: "inline-block" }}
                ref={templatePickerRef}
              >
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
            {programs.length > 0 && (
              <button
                className={styles.addButton}
                onClick={() => setShowProgramLoader((prev) => !prev)}
              >
                {t("log.loadProgram")}
              </button>
            )}
            {showExercisePicker && (
              <div className={styles.exercisePicker}>
                {pickerMode === "chips" && (
                  <div className={styles.muscleGroupChips}>
                    {[ALL_MUSCLE_GROUPS_FILTER, ...MUSCLE_GROUPS].map((group) => (
                      <button
                        key={group}
                        className={
                          muscleGroupFilter === group
                            ? styles.muscleGroupChipActive
                            : styles.muscleGroupChip
                        }
                        onClick={() => setMuscleGroupFilter(group)}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                )}

                {pickerMode === "twoStep" &&
                  !exerciseName.trim() &&
                  muscleGroupFilter === ALL_MUSCLE_GROUPS_FILTER && (
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

                {pickerMode === "twoStep" &&
                  !exerciseName.trim() &&
                  muscleGroupFilter !== ALL_MUSCLE_GROUPS_FILTER && (
                    <button
                      className={styles.backButton}
                      onClick={() => setMuscleGroupFilter(ALL_MUSCLE_GROUPS_FILTER)}
                    >
                      {t("log.back")}
                    </button>
                  )}

                {(pickerMode === "chips" ||
                  exerciseName.trim() ||
                  muscleGroupFilter !== ALL_MUSCLE_GROUPS_FILTER) && (
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
                            <span className={styles.exercisePickerGroup}>
                              {template.muscleGroup}
                            </span>
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
                    {exerciseName.trim() &&
                      !exerciseTemplates.some(
                        (template) =>
                          template.name.toLowerCase() === exerciseName.trim().toLowerCase(),
                      ) && (
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
                  <option key={group} value={group}>
                    {group}
                  </option>
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

          {showProgramLoader && (
            <ProgramLoader
              workout={workout}
              programs={programs}
              formula={settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA}
              onLoaded={(updatedWorkout) => {
                setWorkout(updatedWorkout);
                setShowProgramLoader(false);
              }}
              onClose={() => setShowProgramLoader(false)}
            />
          )}

          <div className={styles.cardList}>
            {workout.exercises?.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                showE1rm={settings?.showE1rm ?? true}
                e1rmFormula={settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA}
                supersetColor={
                  exercise.supersetGroup ? supersetColorByGroup[exercise.supersetGroup] : null
                }
                isDragging={exerciseDrag.isDragging(exercise.id)}
                dropPosition={exerciseDrag.dropPosition(exercise.id)}
                dragItemProps={exerciseDrag.getItemProps(exercise.id)}
                dragHandleProps={exerciseDrag.getHandleProps(exercise.id)}
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
                        ? {
                            ...currentExercise,
                            supersetGroup: updatedExercise.supersetGroup,
                            notes: updatedExercise.notes,
                          }
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
