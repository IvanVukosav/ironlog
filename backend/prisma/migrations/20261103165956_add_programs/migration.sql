-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "programDay" INTEGER;
ALTER TABLE "Workout" ADD COLUMN "programId" INTEGER;
ALTER TABLE "Workout" ADD COLUMN "programWeek" INTEGER;

-- CreateTable
CREATE TABLE "Program" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "weeks" INTEGER NOT NULL,
    "trainingMaxPercent" REAL NOT NULL DEFAULT 100
);

-- CreateTable
CREATE TABLE "ProgramDay" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dayNumber" INTEGER NOT NULL,
    "name" TEXT,
    "programId" INTEGER NOT NULL,
    CONSTRAINT "ProgramDay_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramExercise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "weekSchemes" TEXT NOT NULL,
    "programDayId" INTEGER NOT NULL,
    CONSTRAINT "ProgramExercise_programDayId_fkey" FOREIGN KEY ("programDayId") REFERENCES "ProgramDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Program_name_key" ON "Program"("name");
