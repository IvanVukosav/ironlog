import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { findBestSetByE1rm } from "../utils/oneRepMax";
import { buildProgramSets, parseScheme } from "../utils/programScheme";
import { useReportError } from "./useReportError";

/**
 * The next day of the program being followed (the one the latest trained workout came from),
 * with its sets worked out the way Trening's program loader does it:
 * { program, week, day, dayName, exercises: [{ name, supersetGroup, sets, missingE1rm }] }.
 *
 * Undefined while it is being asked for, null when no program is followed or the program is
 * over. With `enabled` false (a day that already has its workout) nothing is asked.
 */
export function useNextProgramDay(formula, enabled) {
  const reportError = useReportError();
  const [next, setNext] = useState(undefined);

  useEffect(() => {
    if (!enabled) return undefined;
    let isStale = false;
    Promise.all([
      fetchJson("/api/programs/next"),
      fetchJson("/api/programs"),
      fetchJson("/api/stats/prs"),
    ])
      .then(([position, programs, exerciseSets]) => {
        if (isStale) return;
        const program =
          position && !position.finished
            ? programs.find((candidate) => candidate.id === position.programId)
            : null;
        const programDay = program?.days.find((candidate) => candidate.dayNumber === position.day);
        if (!programDay) {
          setNext(null);
          return;
        }
        const bestE1rmByName = Object.fromEntries(
          exerciseSets.map(({ name, sets }) => [name, findBestSetByE1rm(sets, formula)?.e1rm]),
        );
        const exercises = programDay.exercises
          .map((exercise) => ({
            name: exercise.name,
            supersetGroup: exercise.supersetGroup ?? null,
            ...buildProgramSets(
              parseScheme(exercise.weekSchemes[position.week - 1]) ?? [],
              bestE1rmByName[exercise.name] ?? null,
              program.trainingMaxPercent,
            ),
          }))
          .filter((exercise) => exercise.sets.length > 0);
        setNext({
          program,
          week: position.week,
          day: position.day,
          dayName: programDay.name,
          exercises,
        });
      })
      .catch(reportError);
    return () => {
      isStale = true;
    };
  }, [formula, enabled, reportError]);

  return enabled ? next : null;
}
