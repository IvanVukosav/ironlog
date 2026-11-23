// The server writes its errors in English: they are the API's too, for anything else that calls
// it. The person reading the toast gets them in the page's language instead. Each rule is a
// message the server (or the browser) gives, with its numbers caught, and the key that says it.
// A message no rule knows is shown as it came, after words saying that something failed.
const RULES = [
  [/^Weight must be a number of 0 or more$/, "errors.weight"],
  [/^Reps must be a whole number of 0 or more$/, "errors.reps"],
  [
    /^RPE must be between (\d+) and (\d+)$/,
    "errors.rpe",
    (match) => ({ min: match[1], max: match[2] }),
  ],
  [/^Name is required$/, "errors.nameRequired"],
  [/^Exercise name is required$/, "errors.exerciseNameRequired"],
  [/^Meal name is required$/, "errors.mealNameRequired"],
  [/^Muscle group is required$/, "errors.muscleGroupRequired"],
  [/^At least one exercise is required$/, "errors.exerciseRequired"],
  [/^Every exercise needs a name$/, "errors.exerciseNeedsName"],
  [/^Weeks must be between 1 and (\d+)$/, "errors.weeks", (match) => ({ max: match[1] })],
  [/^Training max must be between 1 and 100%$/, "errors.trainingMax"],
  [/^Between 1 and (\d+) days are required$/, "errors.days", (match) => ({ max: match[1] })],
  [/^Kcal, protein, carbs and fat must be valid numbers$/, "errors.macros"],
  [/^Measurements must be numbers$/, "errors.measurements"],
  [/^weight must be a number above 0$/, "errors.bodyweight"],
  [/^Nothing to copy from that day$/, "errors.nothingToCopy"],
  [/^Not a valid barcode$/, "errors.barcode"],
  [/^Product lookup failed$/, "errors.productLookup"],
  [/^Package size must be a number above 0$/, "errors.packageSize"],
  [/^Not an Iron Log backup file$/, "errors.notABackup"],
  [/^Backup is from a newer version of the app$/, "errors.backupTooNew"],
  [/^Backup data doesn't match the database$/, "errors.backupMismatch"],
  [/ already exists$/, "errors.alreadyExists"],
  [/^Not found$/, "errors.notFound"],
  [/^Too many attempts$/, "errors.tooManyAttempts"],
  [/^Wrong password$/, "errors.wrongPassword"],
  [/^Internal server error$/, "errors.server"],
  // What fetch throws without a connection: Chrome, Firefox and Safari word it differently.
  [/^Failed to fetch$|^NetworkError|^Load failed$/, "errors.network"],
  [/^Request failed with status (\d+)$/, "errors.status", (match) => ({ status: match[1] })],
];

export function errorMessage(err, t) {
  const message = String(err?.message ?? "");
  for (const [pattern, key, params] of RULES) {
    const match = pattern.exec(message);
    if (match) return t(key, params ? params(match) : {});
  }
  return t("errors.other", { message });
}
