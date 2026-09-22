-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "supersetGroup" TEXT;

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "waist" REAL,
    "chest" REAL,
    "arms" REAL,
    "thighs" REAL,
    "hips" REAL
);

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
    "exerciseId" INTEGER NOT NULL,
    CONSTRAINT "Set_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Set" ("exerciseId", "id", "order", "reps", "rpe", "weight") SELECT "exerciseId", "id", "order", "reps", "rpe", "weight" FROM "Set";
DROP TABLE "Set";
ALTER TABLE "new_Set" RENAME TO "Set";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BodyMeasurement_date_key" ON "BodyMeasurement"("date");
