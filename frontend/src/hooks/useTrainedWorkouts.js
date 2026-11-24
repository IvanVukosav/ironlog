import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { isConnectionError } from "../utils/outbox";
import { REPEAT_PAGE } from "../utils/repeatWorkout";
import { useReportError } from "./useReportError";

const pagePath = (after) =>
  `/api/workouts/trained?limit=${REPEAT_PAGE}${after ? `&after=${after}` : ""}`;

/**
 * The trained workouts, newest first, each with its done sets: what "Ponovi trening" offers
 * (see utils/repeatWorkout.js). They come REPEAT_PAGE at a time: { workouts, hasMore,
 * isLoadingMore, loadMore }, `loadMore()` adding the next older ones. Empty until the first come,
 * and without a connection (then there is nothing to offer, and nothing worth an error).
 */
export function useTrainedWorkouts() {
  const reportError = useReportError();
  const [list, setList] = useState({ workouts: [], hasMore: false });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let isStale = false;
    fetchJson(pagePath(null))
      .then((page) => {
        if (!isStale) setList({ workouts: page, hasMore: page.length === REPEAT_PAGE });
      })
      .catch((err) => {
        if (!isConnectionError(err)) reportError(err);
      });
    return () => {
      isStale = true;
    };
  }, [reportError]);

  const loadMore = () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    fetchJson(pagePath(list.workouts.at(-1)?.id))
      .then((page) =>
        setList((current) => ({
          workouts: [...current.workouts, ...page],
          hasMore: page.length === REPEAT_PAGE,
        })),
      )
      .catch(reportError)
      .finally(() => setIsLoadingMore(false));
  };

  return { ...list, isLoadingMore, loadMore };
}
