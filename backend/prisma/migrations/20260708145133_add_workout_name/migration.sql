-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "name" TEXT;

-- CreateTable
CREATE TABLE "ExerciseTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseTemplate_name_key" ON "ExerciseTemplate"("name");
