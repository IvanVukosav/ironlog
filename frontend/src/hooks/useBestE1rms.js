import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { findBestSetByE1rm } from "../utils/oneRepMax";
import { useReportError } from "./useReportError";

/**
 * Each exercise's best e1RM by `formula`, from every set logged: { [name]: e1RM or null }. A
 * program's sets work their weights out from these.
 */
export async function fetchBestE1rms(formula) {
  const exercises = await fetchJson("/api/stats/prs");
  return Object.fromEntries(
    exercises.map(({ name, sets }) => [name, findBestSetByE1rm(sets, formula)?.e1rm ?? null]),
  );
}

/** fetchBestE1rms as state: empty until the sets have come. */
export function useBestE1rms(formula) {
  const reportError = useReportError();
  const [bestByName, setBestByName] = useState({});

  useEffect(() => {
    let isStale = false;
    fetchBestE1rms(formula)
      .then((best) => {
        if (!isStale) setBestByName(best);
      })
      .catch(reportError);
    return () => {
      isStale = true;
    };
  }, [formula, reportError]);

  return bestByName;
}
