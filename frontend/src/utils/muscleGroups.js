// Muscle groups are saved in Croatian: they are data, chosen once per exercise, and the server
// groups volume by them. These are the groups the app offers, each with the key it is shown
// under in the page's language. A group saved under any other name is shown as it was saved.
const KEY_BY_NAME = {
  Leđa: "back",
  Prsa: "chest",
  Kvadriceps: "quads",
  "Stražnja loža": "hamstrings",
  Ramena: "shoulders",
  Gluteus: "glutes",
  Ruke: "arms",
  Trbušnjaci: "abs",
  // What the server calls the volume of exercises without a group.
  Ostalo: "other",
};

export const MUSCLE_GROUPS = [
  "Leđa",
  "Prsa",
  "Kvadriceps",
  "Stražnja loža",
  "Ramena",
  "Gluteus",
  "Ruke",
  "Trbušnjaci",
];

export function muscleGroupLabel(name, t) {
  const key = KEY_BY_NAME[name];
  return key ? t(`muscleGroups.${key}`) : name;
}
