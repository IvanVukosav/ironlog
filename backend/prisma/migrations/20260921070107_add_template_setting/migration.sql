-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "showWorkoutWidget" BOOLEAN NOT NULL DEFAULT true,
    "showNutritionWidget" BOOLEAN NOT NULL DEFAULT true,
    "showCalendarWidget" BOOLEAN NOT NULL DEFAULT true,
    "kcalGoal" INTEGER NOT NULL DEFAULT 2500,
    "proteinGoal" INTEGER NOT NULL DEFAULT 180,
    "trainingsPerWeek" INTEGER NOT NULL DEFAULT 4,
    "carbsGoal" INTEGER NOT NULL DEFAULT 250,
    "fatGoal" INTEGER NOT NULL DEFAULT 80,
    "exercisePickerMode" TEXT NOT NULL DEFAULT 'chips',
    "showE1rm" BOOLEAN NOT NULL DEFAULT true,
    "e1rmFormula" TEXT NOT NULL DEFAULT 'brzycki',
    "language" TEXT NOT NULL DEFAULT 'hr',
    "theme" TEXT NOT NULL DEFAULT 'dark-red',
    "template" TEXT NOT NULL DEFAULT 'terminal'
);
INSERT INTO "new_Settings" ("carbsGoal", "e1rmFormula", "exercisePickerMode", "fatGoal", "id", "kcalGoal", "language", "proteinGoal", "showCalendarWidget", "showE1rm", "showNutritionWidget", "showWorkoutWidget", "theme", "trainingsPerWeek") SELECT "carbsGoal", "e1rmFormula", "exercisePickerMode", "fatGoal", "id", "kcalGoal", "language", "proteinGoal", "showCalendarWidget", "showE1rm", "showNutritionWidget", "showWorkoutWidget", "theme", "trainingsPerWeek" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
