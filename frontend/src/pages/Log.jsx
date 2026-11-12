import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ExerciseCard from "../components/ExerciseCard";
import DatePicker from "../components/DatePicker";
import Icon from "../components/Icon";
import ProgramLoader from "../components/ProgramLoader";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import { useSettings } from "../context/useSettings";
import { useDragReorder } from "../hooks/useDragReorder";
import { useReportError } from "../hooks/useReportError";
import { useWorkout } from "../hooks/useWorkout";
import { DEFAULT_E1RM_FORMULA } from "../utils/oneRepMax";
import { formatWeekdayDate, todayKey } from "../utils/dates";
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
  const { t, i18n } = useTranslation();
  const { showError } = useToast();
  const reportError = useReportError();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || todayKey());
  const { workout, isLoading, ...actions } = useWorkout(date);
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
  const [showWorkoutMenu, setShowWorkoutMenu] = useState(false);
  // The workout whose notes box was opened from the menu; a workout with notes always shows it.
  const [notesOpenFor, setNotesOpenFor] = useState(null);
  const exercisePickerRef = useRef(null);
  const templatePickerRef = useRef(null);
  const workoutMenuRef = useRef(null);
  const pickerMode = settings?.exercisePickerMode ?? "chips";
  const showWorkoutNotes = Boolean(workout?.notes) || notesOpenFor === workout?.id;

  const exerciseDrag = useDragReorder(workout?.exercises || [], actions.reorderExercises);

  useEffect(() => {
    fetchJson("/api/exercise-templates").then(setExerciseTemplates).catch(reportError);
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
      if (workoutMenuRef.current && !workoutMenuRef.current.contains(event.target)) {
        setShowWorkoutMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Each menu item closes the menu, then does its thing.
  const fromWorkoutMenu = (run) => () => {
    setShowWorkoutMenu(false);
    run();
  };

  const deleteWorkout = () => {
    if (window.confirm(t("log.confirmDeleteWorkout"))) actions.deleteWorkout();
  };

  const addExercise = async () => {
    const name = exerciseName.trim();
    if (!name) return;

    const isSameName = (other) => other.name.toLowerCase() === name.toLowerCase();
    if (workout.exercises.some(isSameName)) {
      showError(t("log.exerciseAlreadyAdded", { name }));
      // Left open, the list would lie over the cards and take the next click meant for them.
      setShowExercisePicker(false);
      return;
    }

    if (!(await actions.addExercise(name))) return;
    setExerciseName("");
    setShowExercisePicker(false);
    // Only an exercise that made it into the workout is worth offering for the list.
    if (!exerciseTemplates.some(isSameName)) setSavePromptName(name);
  };

  // Saved when the box is left, and only if it says something new.
  const updateWorkoutName = (name) => {
    if (name.trim() !== (workout.name || "")) actions.updateWorkout({ name });
  };

  const updateWorkoutNotes = (notes) => {
    if (notes.trim() !== (workout.notes || "")) actions.updateWorkout({ notes });
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

  const applyWorkoutTemplate = async (templateId) => {
    if (await actions.applyTemplate(templateId)) setShowTemplatePicker(false);
  };

  const loadProgramDay = async (program, exercises) => {
    if (await actions.loadProgramDay(program, exercises)) setShowProgramLoader(false);
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
      {/* The bar above names the page; the heading is for screen readers. */}
      <h1 className={styles.srOnly}>{t("log.title")}</h1>

      <header className={styles.header}>
        <div className={styles.headerText}>
          <DatePicker value={date} onChange={setDate} variant="text">
            {formatWeekdayDate(date, i18n.language)}
            <Icon name="chevronDown" size={16} />
          </DatePicker>
          {workout && (
            // Uncontrolled: the key is what makes it show the next day's workout.
            <input
              key={workout.id}
              type="text"
              className={styles.workoutName}
              aria-label={t("log.workoutNameLabel")}
              placeholder={t("log.untitledWorkout")}
              defaultValue={workout.name || ""}
              onBlur={(event) => updateWorkoutName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.target.blur();
              }}
            />
          )}
          {workoutProgram && (
            <span className={styles.programTag}>
              {t("log.programTag", {
                name: workoutProgram.name,
                week: workout.programWeek,
                day: workout.programDay,
              })}
            </span>
          )}
        </div>
        {workout && (
          <div className={styles.menuWrapper} ref={workoutMenuRef}>
            <button
              type="button"
              className={styles.menuButton}
              aria-label={t("log.workoutOptions")}
              aria-expanded={showWorkoutMenu}
              onClick={() => setShowWorkoutMenu((prev) => !prev)}
            >
              <Icon name="more" />
            </button>
            {showWorkoutMenu && (
              <div className={styles.menuDropdown}>
                {!showWorkoutNotes && (
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={fromWorkoutMenu(() => setNotesOpenFor(workout.id))}
                  >
                    {t("log.addNote")}
                  </button>
                )}
                {workout.exercises.length > 0 && (
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={fromWorkoutMenu(() => setSaveTemplateName(""))}
                  >
                    {t("log.saveAsTemplate")}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={fromWorkoutMenu(deleteWorkout)}
                >
                  {t("log.deleteWorkout")}
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {workout && showWorkoutNotes && (
        <textarea
          key={workout.id}
          className={styles.workoutNotesInput}
          aria-label={t("log.workoutNotesPlaceholder")}
          placeholder={t("log.workoutNotesPlaceholder")}
          rows={2}
          autoFocus={!workout.notes}
          defaultValue={workout.notes || ""}
          onBlur={(event) => updateWorkoutNotes(event.target.value)}
        />
      )}

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

      {/* Not offered until the day has answered: it may turn out to have a workout already. */}
      {!workout && !isLoading && (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>{t("log.noWorkout")}</p>
          <button type="button" className={styles.startButton} onClick={actions.createWorkout}>
            {t("log.startWorkout")}
          </button>
        </div>
      )}

      {workout && (
        <div>
          <div className={styles.addRow}>
            <div className={styles.addExercise} ref={exercisePickerRef}>
              <input
                type="text"
                className={styles.exerciseInput}
                aria-label={t("log.searchOrTypeExercise")}
                placeholder={t("log.searchOrTypeExercise")}
                value={exerciseName}
                onChange={(event) => {
                  setExerciseName(event.target.value);
                  setShowExercisePicker(true);
                  setSavePromptName(null);
                }}
                onFocus={() => setShowExercisePicker(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setShowExercisePicker(false);
                }}
              />
              <button type="button" className={styles.addButton} onClick={addExercise}>
                {t("log.addExercise")}
              </button>
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
            {(workoutTemplates.length > 0 || programs.length > 0) && (
              <div className={styles.loaders}>
                {workoutTemplates.length > 0 && (
                  <div className={styles.templatePicker} ref={templatePickerRef}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      aria-expanded={showTemplatePicker}
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
                              aria-label={t("common.delete")}
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
                    type="button"
                    className={styles.secondaryButton}
                    aria-expanded={showProgramLoader}
                    onClick={() => setShowProgramLoader((prev) => !prev)}
                  >
                    {t("log.loadProgram")}
                  </button>
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
              programs={programs}
              formula={settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA}
              onLoad={loadProgramDay}
              onClose={() => setShowProgramLoader(false)}
            />
          )}

          <div className={styles.cardList}>
            {workout.exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                actions={actions}
                showE1rm={settings?.showE1rm ?? true}
                e1rmFormula={settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA}
                supersetColor={
                  exercise.supersetGroup ? supersetColorByGroup[exercise.supersetGroup] : null
                }
                isDragging={exerciseDrag.isDragging(exercise.id)}
                dropPosition={exerciseDrag.dropPosition(exercise.id)}
                dragItemProps={exerciseDrag.getItemProps(exercise.id)}
                dragHandleProps={exerciseDrag.getHandleProps(exercise.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Log;
