import { useId, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { findBestSetByE1rm } from "../utils/oneRepMax";
import { buildProgramSets, parseScheme } from "../utils/programScheme";
import { formatNumber } from "../utils/numbers";
import { useReportError } from "../hooks/useReportError";
import styles from "./ProgramLoader.module.css";

const isSameRun = (a, b) =>
  a.weight === b.weight && a.reps === b.reps && a.rpe === b.rpe && a.drops === b.drops;

// "1×1 @ 162,5 kg, 3×5 @ 135 kg + 1 drop" from consecutive identical sets; a set's drop sets
// count with it.
function summarizeSets(sets, language, t) {
  const single = [];
  for (const set of sets) {
    if (set.isDrop) {
      if (single.length > 0) single.at(-1).drops += 1;
    } else {
      single.push({ ...set, drops: 0 });
    }
  }
  const runs = [];
  for (const set of single) {
    const last = runs.at(-1);
    if (last && isSameRun(last, set)) last.count += 1;
    else runs.push({ ...set, count: 1 });
  }
  return runs
    .map((run) => {
      const load = run.weight ? ` @ ${formatNumber(run.weight, language)} kg` : "";
      const rpe = run.rpe !== null ? ` RPE ${formatNumber(run.rpe, language)}` : "";
      const drops = run.drops > 0 ? ` ${t("programs.dropCount", { count: run.drops })}` : "";
      return `${run.count}×${run.reps}${load}${rpe}${drops}`;
    })
    .join(", ");
}

// `onLoad(program, exercises)` puts the chosen day's sets into the workout; `program` is
// { id, week, day }.
function ProgramLoader({ programs, formula, onLoad, onClose }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const reportError = useReportError();
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
          Object.fromEntries(
            data.map((exercise) => [
              exercise.name,
              findBestSetByE1rm(exercise.sets, formula)?.e1rm ?? null,
            ]),
          ),
        ),
      )
      .catch(reportError);
  }, [formula, reportError]);

  useEffect(() => {
    if (!programId) return;
    fetchJson(`/api/programs/${programId}/next`)
      .then((next) => {
        setWeek(next.week);
        setDay(next.day);
        setIsProgramFinished(next.finished);
      })
      .catch(reportError);
  }, [programId, reportError]);

  const programDay = program?.days.find((candidate) => candidate.dayNumber === day);
  const plannedExercises = (programDay?.exercises ?? [])
    .map((exercise) => {
      const groups = parseScheme(exercise.weekSchemes[week - 1]) ?? [];
      const e1rm = bestE1rmByName[exercise.name] ?? null;
      return {
        name: exercise.name,
        supersetGroup: exercise.supersetGroup ?? null,
        ...buildProgramSets(groups, e1rm, program.trainingMaxPercent),
      };
    })
    .filter((exercise) => exercise.sets.length > 0);

  const load = () =>
    onLoad(
      { id: programId, week, day },
      plannedExercises.map(({ name, sets, supersetGroup }) => ({ name, sets, supersetGroup })),
    );

  if (!program) return null;

  return (
    <section className={styles.panel}>
      <div className={styles.selectors}>
        <div className={`${styles.field} ${styles.programField}`}>
          <label className={styles.fieldLabel} htmlFor={`${id}program`}>
            {t("programs.programLabel")}
          </label>
          <select
            id={`${id}program`}
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
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${id}week`}>
            {t("programs.weekLabel")}
          </label>
          <select
            id={`${id}week`}
            className={styles.select}
            value={week}
            onChange={(event) => setWeek(parseInt(event.target.value))}
          >
            {Array.from({ length: program.weeks }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${id}day`}>
            {t("programs.dayLabel")}
          </label>
          <select
            id={`${id}day`}
            className={styles.select}
            value={day}
            onChange={(event) => setDay(parseInt(event.target.value))}
          >
            {program.days.map((candidate) => (
              <option key={candidate.dayNumber} value={candidate.dayNumber}>
                {candidate.name || t("programs.dayNumber", { number: candidate.dayNumber })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isProgramFinished && <p className={styles.hint}>{t("programs.finished")}</p>}

      {plannedExercises.length > 0 ? (
        <ul className={styles.preview}>
          {plannedExercises.map((exercise) => (
            <li key={exercise.name} className={styles.previewRow}>
              <span className={styles.previewName}>{exercise.name}</span>
              <span className={styles.previewSets}>
                {summarizeSets(exercise.sets, i18n.language, t)}
              </span>
              {exercise.missingE1rm && (
                <span className={styles.warning}>{t("programs.missingE1rm")}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>{t("programs.nothingThisDay")}</p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.loadButton}
          disabled={plannedExercises.length === 0}
          onClick={load}
        >
          {t("programs.load")}
        </button>
        <button type="button" className={styles.cancelButton} onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </section>
  );
}

export default ProgramLoader;
