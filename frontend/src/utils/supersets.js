const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Whether each exercise is in one superset with the one after it: both have the same letter.
const linksOf = (groups) =>
  groups.map((group, index) => Boolean(group) && group === groups[index + 1]);

/**
 * Superset letters from the links between neighbours (`linked[i]`: exercise i goes with i + 1).
 * Each run of linked exercises gets the next letter down the day (A, B, …); an exercise on its
 * own gets null.
 */
export function lettersFromLinks(linked) {
  const letters = linked.map(() => null);
  let runStart = 0;
  let nextLetter = 0;
  linked.forEach((isLinked, index) => {
    if (isLinked && index < linked.length - 1) return;
    if (index > runStart) {
      const letter = LETTERS[nextLetter] ?? LETTERS.at(-1);
      nextLetter += 1;
      for (let member = runStart; member <= index; member += 1) letters[member] = letter;
    }
    runStart = index + 1;
  });
  return letters;
}

/** The letters again, in order down the day, with a superset of one taken apart. */
export function tidySupersets(groups) {
  return lettersFromLinks(linksOf(groups));
}

/** Links exercise `index` with the next one into a superset, or takes them apart. */
export function toggleSuperset(groups, index) {
  const linked = linksOf(groups);
  linked[index] = !linked[index];
  return lettersFromLinks(linked);
}

/** "A1", "A2", … for the exercises in a superset, null for the others. */
export function supersetLabels(groups) {
  const labels = [];
  groups.forEach((group, index) => {
    if (!group) {
      labels.push(null);
      return;
    }
    const before = index > 0 && groups[index - 1] === group ? labels[index - 1] : null;
    const place = before ? Number(before.slice(group.length)) + 1 : 1;
    labels.push(`${group}${place}`);
  });
  return labels;
}
