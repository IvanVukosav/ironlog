-- Names typed with a stray space ("Bench ") were stored as a different exercise from "Bench".
-- New names are trimmed by the API; this cleans up the ones already saved.
UPDATE "Exercise" SET "name" = TRIM("name") WHERE "name" <> TRIM("name");
UPDATE "WorkoutTemplateExercise" SET "name" = TRIM("name") WHERE "name" <> TRIM("name");
UPDATE "ProgramExercise" SET "name" = TRIM("name") WHERE "name" <> TRIM("name");
UPDATE "Settings" SET "squatExercise" = TRIM("squatExercise") WHERE "squatExercise" <> TRIM("squatExercise");
UPDATE "Settings" SET "benchExercise" = TRIM("benchExercise") WHERE "benchExercise" <> TRIM("benchExercise");
UPDATE "Settings" SET "deadliftExercise" = TRIM("deadliftExercise") WHERE "deadliftExercise" <> TRIM("deadliftExercise");
