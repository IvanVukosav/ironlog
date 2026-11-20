import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { findBestSetByE1rm } from "../utils/oneRepMax";
import { useReportError } from "./useReportError";

/**
 * Each exercise's best e1RM by `formula`, from every set logged: { [name]: e1RM or null }, empty
 * until the sets have come. A program's sets work their weights out from these.
 */
export function useBestE1rms(formula) {
  const reportError = useReportError();
  const [bestByName, setBestByName] = useState({});

  useEffect(() => {
    let isStale = false;
    fetchJson("/api/stats/prs")
      .then((exercises) => {
        if (isStale) return;
        setBestByName(
          Object.fromEntries(
            exercises.map(({ name, sets }) => [
              name,
              findBestSetByE1rm(sets, formula)?.e1rm ?? null,
            ]),
          ),
        );
      })
      .catch(reportError);
    return () => {
      isStale = true;
    };
  }, [formula, reportError]);

  return bestByName;
}
