// "Ponovi trening": a past workout started again as a plan.

// How many past workouts the list offers.
export const REPEAT_CHOICES = 10;

/**
 * The past workouts to offer, newest first: the trained ones (from /api/workouts/trained, which
 * asks for one more than REPEAT_CHOICES) without the workout being filled in, `excludeId`.
 */
export function repeatChoices(trained, excludeId) {
  return trained.filter((workout) => workout.id !== excludeId).slice(0, REPEAT_CHOICES);
}

/**
 * A workout's exercises as they are loaded again (the body of POST .../exercises/bulk): in the
 * same order, each with its done sets (weight, reps, RPE, warm-ups, drop sets, back-offs) and its
 * superset letter. `isDone` is what every set starts as: false for a plan to tick off. An exercise
 * with no done set is left out.
 */
export function repeatedExercises(workout, isDone) {
  return workout.exercises
    .map((exercise) => ({
      name: exercise.name,
      supersetGroup: exercise.supersetGroup ?? null,
      sets: exercise.sets
        .filter((set) => set.isDone)
        .map((set) => ({
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe,
          isWarmup: set.isWarmup,
          isDrop: set.isDrop,
          backoffPercent: set.backoffPercent ?? null,
          isDone,
        })),
    }))
    .filter((exercise) => exercise.sets.length > 0);
}

/** How many working sets (done, neither warm-up nor drop) the workout has. */
export function workingSetCount(workout) {
  return workout.exercises
    .flatMap((exercise) => exercise.sets)
    .filter((set) => set.isDone && !set.isWarmup && !set.isDrop).length;
}
