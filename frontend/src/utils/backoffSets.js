import { backoffWeight, dropWeights } from "./programScheme";

const isMainSet = (set) => !set.isWarmup && !set.isDrop;
const followsTop = (set) => set.backoffPercent !== null && set.backoffPercent !== undefined;

/**
 * In Trening, the back-off sets after a top set follow the weight it is really done with. Given an
 * exercise's sets in order and the top set that was just done or changed, this is what changes:
 * [{ id, weight }] for each back-off set not done yet whose weight is now another, and for the
 * drop sets right after one (each 20 % lighter than the set before). The back-off sets run until
 * the next working set that isn't one. A back-off set already done keeps its weight, and so does
 * one changed by hand, which no longer has a `backoffPercent`.
 */
export function backoffUpdates(sets, topId) {
  const index = sets.findIndex((set) => set.id === topId);
  const top = sets[index];
  if (!top || !isMainSet(top) || followsTop(top) || !(top.weight > 0)) return [];

  const updates = [];
  // The weight of the back-off set just passed, for the drop sets after it.
  let previous = null;
  for (const set of sets.slice(index + 1)) {
    if (set.isWarmup) continue;
    let weight;
    if (set.isDrop) {
      // The top set's own drop sets come before any back-off set and are left alone.
      if (previous === null) continue;
      weight = dropWeights(previous, 1)[0];
    } else if (followsTop(set)) {
      weight = backoffWeight(top.weight, set.backoffPercent);
    } else {
      break;
    }
    if (set.isDone) {
      previous = set.weight;
      continue;
    }
    if (weight !== set.weight) updates.push({ id: set.id, weight });
    previous = weight;
  }
  return updates;
}
