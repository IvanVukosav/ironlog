// A set loaded from a program stays a plan (isDone false) until it is ticked off. Only done sets
// count anywhere: in records, volume, history, "last time" and the training days.
const DONE_SET = { isDone: true };

// A workout with at least one done set: a day with only a plan in it, or nothing at all, was not
// trained yet.
const TRAINED_WORKOUT = { exercises: { some: { sets: { some: DONE_SET } } } };

module.exports = { DONE_SET, TRAINED_WORKOUT };
