-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "WorkoutTemplateExercise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "workoutTemplateId" INTEGER NOT NULL,
    CONSTRAINT "WorkoutTemplateExercise_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutTemplateSet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weight" REAL NOT NULL,
    "reps" INTEGER NOT NULL,
    "rpe" REAL,
    "workoutTemplateExerciseId" INTEGER NOT NULL,
    CONSTRAINT "WorkoutTemplateSet_workoutTemplateExerciseId_fkey" FOREIGN KEY ("workoutTemplateExerciseId") REFERENCES "WorkoutTemplateExercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplate_name_key" ON "WorkoutTemplate"("name");
