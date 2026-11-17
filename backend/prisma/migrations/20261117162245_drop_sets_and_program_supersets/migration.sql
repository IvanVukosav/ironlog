-- AlterTable
ALTER TABLE "ProgramExercise" ADD COLUMN "supersetGroup" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Set" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weight" REAL NOT NULL,
    "reps" INTEGER NOT NULL,
    "rpe" REAL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isWarmup" BOOLEAN NOT NULL DEFAULT false,
    "isDrop" BOOLEAN NOT NULL DEFAULT false,
    "isDone" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" DATETIME,
    "exerciseId" INTEGER NOT NULL,
    CONSTRAINT "Set_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Set" ("completedAt", "exerciseId", "id", "isDone", "isWarmup", "order", "reps", "rpe", "weight") SELECT "completedAt", "exerciseId", "id", "isDone", "isWarmup", "order", "reps", "rpe", "weight" FROM "Set";
DROP TABLE "Set";
ALTER TABLE "new_Set" RENAME TO "Set";
CREATE INDEX "Set_exerciseId_idx" ON "Set"("exerciseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
