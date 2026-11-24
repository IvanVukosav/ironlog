import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { isConnectionError } from "../utils/outbox";
import { REPEAT_CHOICES } from "../utils/repeatWorkout";
import { useReportError } from "./useReportError";

/**
 * The latest trained workouts, newest first, each with its done sets: what "Ponovi trening"
 * offers (see utils/repeatWorkout.js). One more than REPEAT_CHOICES is asked for, so the list stays
 * full without the workout being filled in. Empty until they come, and without a connection
 * (then there is nothing to offer, and nothing worth an error).
 */
export function useTrainedWorkouts() {
  const reportError = useReportError();
  const [workouts, setWorkouts] = useState([]);

  useEffect(() => {
    let isStale = false;
    fetchJson(`/api/workouts/trained?limit=${REPEAT_CHOICES + 1}`)
      .then((data) => {
        if (!isStale) setWorkouts(data);
      })
      .catch((err) => {
        if (!isConnectionError(err)) reportError(err);
      });
    return () => {
      isStale = true;
    };
  }, [reportError]);

  return workouts;
}
