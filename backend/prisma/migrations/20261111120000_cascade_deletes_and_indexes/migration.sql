-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "supersetGroup" TEXT,
    "notes" TEXT,
    "workoutId" INTEGER NOT NULL,
    CONSTRAINT "Exercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Exercise" ("id", "name", "notes", "order", "supersetGroup", "workoutId") SELECT "id", "name", "notes", "order", "supersetGroup", "workoutId" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
CREATE INDEX "Exercise_workoutId_idx" ON "Exercise"("workoutId");
CREATE INDEX "Exercise_name_idx" ON "Exercise"("name");
CREATE TABLE "new_FoodItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "kcal" REAL NOT NULL,
    "protein" REAL NOT NULL,
    "carbs" REAL NOT NULL,
    "fat" REAL NOT NULL,
    "mealId" INTEGER NOT NULL,
    CONSTRAINT "FoodItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FoodItem" ("carbs", "fat", "id", "kcal", "mealId", "name", "protein") SELECT "carbs", "fat", "id", "kcal", "mealId", "name", "protein" FROM "FoodItem";
DROP TABLE "FoodItem";
ALTER TABLE "new_FoodItem" RENAME TO "FoodItem";
CREATE INDEX "FoodItem_mealId_idx" ON "FoodItem"("mealId");
CREATE TABLE "new_Meal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nutritionDayId" INTEGER NOT NULL,
    CONSTRAINT "Meal_nutritionDayId_fkey" FOREIGN KEY ("nutritionDayId") REFERENCES "NutritionDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Meal" ("id", "name", "nutritionDayId") SELECT "id", "name", "nutritionDayId" FROM "Meal";
DROP TABLE "Meal";
ALTER TABLE "new_Meal" RENAME TO "Meal";
CREATE INDEX "Meal_nutritionDayId_idx" ON "Meal"("nutritionDayId");
CREATE TABLE "new_Set" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weight" REAL NOT NULL,
    "reps" INTEGER NOT NULL,
    "rpe" REAL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isWarmup" BOOLEAN NOT NULL DEFAULT false,
    "exerciseId" INTEGER NOT NULL,
    CONSTRAINT "Set_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Set" ("exerciseId", "id", "isWarmup", "order", "reps", "rpe", "weight") SELECT "exerciseId", "id", "isWarmup", "order", "reps", "rpe", "weight" FROM "Set";
DROP TABLE "Set";
ALTER TABLE "new_Set" RENAME TO "Set";
CREATE INDEX "Set_exerciseId_idx" ON "Set"("exerciseId");
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "showWorkoutWidget" BOOLEAN NOT NULL DEFAULT true,
    "showNutritionWidget" BOOLEAN NOT NULL DEFAULT true,
    "showPrWidget" BOOLEAN NOT NULL DEFAULT true,
    "kcalGoal" INTEGER NOT NULL DEFAULT 2500,
    "proteinGoal" INTEGER NOT NULL DEFAULT 180,
    "trainingsPerWeek" INTEGER NOT NULL DEFAULT 4,
    "carbsGoal" INTEGER NOT NULL DEFAULT 250,
    "fatGoal" INTEGER NOT NULL DEFAULT 80,
    "exercisePickerMode" TEXT NOT NULL DEFAULT 'chips',
    "showE1rm" BOOLEAN NOT NULL DEFAULT true,
    "e1rmFormula" TEXT NOT NULL DEFAULT 'brzycki',
    "language" TEXT NOT NULL DEFAULT 'hr',
    "theme" TEXT NOT NULL DEFAULT 'auto',
    "template" TEXT NOT NULL DEFAULT 'moderna',
    "sex" TEXT NOT NULL DEFAULT 'male',
    "squatExercise" TEXT,
    "benchExercise" TEXT,
    "deadliftExercise" TEXT,
    "featuredExercises" TEXT NOT NULL DEFAULT '[]',
    "showPowerliftingTotal" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Settings" ("benchExercise", "carbsGoal", "deadliftExercise", "e1rmFormula", "exercisePickerMode", "fatGoal", "featuredExercises", "id", "kcalGoal", "language", "proteinGoal", "sex", "showE1rm", "showNutritionWidget", "showPowerliftingTotal", "showPrWidget", "showWorkoutWidget", "squatExercise", "template", "theme", "trainingsPerWeek") SELECT "benchExercise", "carbsGoal", "deadliftExercise", "e1rmFormula", "exercisePickerMode", "fatGoal", "featuredExercises", "id", "kcalGoal", "language", "proteinGoal", "sex", "showE1rm", "showNutritionWidget", "showPowerliftingTotal", "showPrWidget", "showWorkoutWidget", "squatExercise", "template", "theme", "trainingsPerWeek" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_WorkoutTemplateExercise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "workoutTemplateId" INTEGER NOT NULL,
    CONSTRAINT "WorkoutTemplateExercise_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutTemplateExercise" ("id", "name", "workoutTemplateId") SELECT "id", "name", "workoutTemplateId" FROM "WorkoutTemplateExercise";
DROP TABLE "WorkoutTemplateExercise";
ALTER TABLE "new_WorkoutTemplateExercise" RENAME TO "WorkoutTemplateExercise";
CREATE INDEX "WorkoutTemplateExercise_workoutTemplateId_idx" ON "WorkoutTemplateExercise"("workoutTemplateId");
CREATE TABLE "new_WorkoutTemplateSet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weight" REAL NOT NULL,
    "reps" INTEGER NOT NULL,
    "rpe" REAL,
    "workoutTemplateExerciseId" INTEGER NOT NULL,
    CONSTRAINT "WorkoutTemplateSet_workoutTemplateExerciseId_fkey" FOREIGN KEY ("workoutTemplateExerciseId") REFERENCES "WorkoutTemplateExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutTemplateSet" ("id", "reps", "rpe", "weight", "workoutTemplateExerciseId") SELECT "id", "reps", "rpe", "weight", "workoutTemplateExerciseId" FROM "WorkoutTemplateSet";
DROP TABLE "WorkoutTemplateSet";
ALTER TABLE "new_WorkoutTemplateSet" RENAME TO "WorkoutTemplateSet";
CREATE INDEX "WorkoutTemplateSet_workoutTemplateExerciseId_idx" ON "WorkoutTemplateSet"("workoutTemplateExerciseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProgramDay_programId_idx" ON "ProgramDay"("programId");

-- CreateIndex
CREATE INDEX "ProgramExercise_programDayId_idx" ON "ProgramExercise"("programDayId");

-- CreateIndex
CREATE INDEX "Workout_date_idx" ON "Workout"("date");

