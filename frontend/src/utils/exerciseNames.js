// Names the user picked (Settings, stars) may differ from the logged ones in case or stray spaces.
export function isSameExerciseName(nameA, nameB) {
  return nameA.trim().toLowerCase() === nameB.trim().toLowerCase();
}
