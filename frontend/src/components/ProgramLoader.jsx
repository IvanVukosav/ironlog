import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { findBestSetByE1rm } from "../utils/oneRepMax";
import { buildProgramSets, parseScheme } from "../utils/programScheme";
import { useToast } from "../context/useToast";
import styles from "./ProgramLoader.module.css";

// "1×162.5 kg, 3×135 kg" from consecutive identical sets.
function summarizeSets(sets) {
  const runs = [];
  for (const set of sets) {
    const last = runs.at(-1);
    if (last && last.weight === set.weight && last.reps === set.reps && last.rpe === set.rpe) {
      last.count += 1;
    } else {
      runs.push({ ...set, count: 1 });
    }
  }
  return runs
    .map((run) => {
      const load = run.weight ? ` @ ${run.weight} kg` : "";
      const rpe = run.rpe !== null ? ` RPE ${run.rpe}` : "";
      return `${run.count}×${run.reps}${load}${rpe}`;
    })
    .join(", ");
}

function ProgramLoader({ workout, programs, formula, onLoaded, onClose }) {
  const { t } = useTranslation();
  const { showError } = useToast();
  const [programId, setProgramId] = useState(programs[0]?.id ?? null);
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  const [isProgramFinished, setIsProgramFinished] = useState(false);
  const [bestE1rmByName, setBestE1rmByName] = useState({});
  const program = programs.find((candidate) => candidate.id === programId);

  useEffect(() => {
    fetchJson("/api/stats/prs")
      .then((data) =>
        setBestE1rmByName(
          Object.fromEntries(data.map((exercise) => [exercise.name, findBestSetByE1rm(exercise.sets, formula)?.e1rm ?? null])),
        ),
      )
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [formula, showError]);

  useEffect(() => {
    if (!programId) return;
    fetchJson(`/api/programs/${programId}/next`)
      .then((next) => {
        setWeek(next.week);
        setDay(next.day);
        setIsProgramFinished(next.finished);
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [programId, showError]);

  const programDay = program?.days.find((candidate) => candidate.dayNumber === day);
  const plannedExercises = (programDay?.exercises ?? [])
    .map((exercise) => {
      const groups = parseScheme(exercise.weekSchemes[week - 1]) ?? [];
      const e1rm = bestE1rmByName[exercise.name] ?? null;
      return { name: exercise.name, ...buildProgramSets(groups, e1rm, program.trainingMaxPercent) };
    })
    .filter((exercise) => exercise.sets.length > 0);

  const load = () => {
    fetchJson(`/api/workouts/${workout.id}/exercises/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        program: { id: programId, week, day },
        exercises: plannedExercises.map(({ name, sets }) => ({ name, sets })),
      }),
    })
      .then((updatedWorkout) => onLoaded(updatedWorkout))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  if (!program) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.selectors}>
        <select
          className={styles.select}
          value={programId}
          onChange={(event) => setProgramId(parseInt(event.target.value))}
        >
          {programs.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
        <select className={styles.select} value={week} onChange={(event) => setWeek(parseInt(event.target.value))}>
          {Array.from({ length: program.weeks }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              {t("programs.weekLong", { number: index + 1 })}
            </option>
          ))}
        </select>
        <select className={styles.select} value={day} onChange={(event) => setDay(parseInt(event.target.value))}>
          {program.days.map((candidate) => (
            <option key={candidate.dayNumber} value={candidate.dayNumber}>
              {candidate.name || t("programs.dayNumber", { number: candidate.dayNumber })}
            </option>
          ))}
        </select>
      </div>

      {isProgramFinished && <p className={styles.hint}>{t("programs.finished")}</p>}

      {plannedExercises.length > 0 ? (
        <ul className={styles.preview}>
          {plannedExercises.map((exercise) => (
            <li key={exercise.name}>
              <span className={styles.previewName}>{exercise.name}</span>
              <span className={styles.previewSets}>{summarizeSets(exercise.sets)}</span>
              {exercise.missingE1rm && <span className={styles.warning}>{t("programs.missingE1rm")}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>{t("programs.nothingThisDay")}</p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.loadButton} disabled={plannedExercises.length === 0} onClick={load}>
          {t("programs.load")}
        </button>
        <button type="button" className={styles.cancelButton} onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

export default ProgramLoader;
