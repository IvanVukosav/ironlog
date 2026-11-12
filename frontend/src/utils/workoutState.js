// Changes to a workout as the Log page holds it: { ...workout, exercises: [{ ...exercise, sets }] }.
// Each one returns a new workout and leaves the one it was given untouched.

function withExercises(workout, change) {
  return { ...workout, exercises: workout.exercises.map(change) };
}

function withListsInExercise(exercise) {
  return { ...exercise, sets: exercise.sets ?? [] };
}

// The API answers a new workout without its exercises and a new exercise without its sets;
// this gives both their (empty) lists, so nothing else has to ask whether they are there.
export function withLists(workout) {
  return { ...workout, exercises: (workout.exercises ?? []).map(withListsInExercise) };
}

// A saved workout or exercise row takes the place of the fields it carries. The rows come
// without their lists, so the exercises and sets on screen stay.
export function withWorkoutChanged(workout, saved) {
  return { ...workout, ...saved, exercises: workout.exercises };
}

export function withExerciseChanged(workout, saved) {
  return withExercises(workout, (exercise) =>
    exercise.id === saved.id ? { ...exercise, ...saved, sets: exercise.sets } : exercise,
  );
}

export function withExercisesAdded(workout, exercises) {
  return { ...workout, exercises: [...workout.exercises, ...exercises.map(withListsInExercise)] };
}

export function withoutExercise(workout, exerciseId) {
  return {
    ...workout,
    exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseId),
  };
}

export function withExercisesInOrder(workout, exercises) {
  return { ...workout, exercises };
}

// A set knows its exercise (`exerciseId`), so it finds its own place.
export function withSetAdded(workout, set) {
  return withExercises(workout, (exercise) =>
    exercise.id === set.exerciseId ? { ...exercise, sets: [...exercise.sets, set] } : exercise,
  );
}

export function withSetChanged(workout, set) {
  return withExercises(workout, (exercise) =>
    exercise.id === set.exerciseId
      ? { ...exercise, sets: exercise.sets.map((other) => (other.id === set.id ? set : other)) }
      : exercise,
  );
}

export function withoutSet(workout, setId) {
  return withExercises(workout, (exercise) =>
    exercise.sets.some((set) => set.id === setId)
      ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
      : exercise,
  );
}

export function withSetsInOrder(workout, exerciseId, sets) {
  return withExercises(workout, (exercise) =>
    exercise.id === exerciseId ? { ...exercise, sets } : exercise,
  );
}
