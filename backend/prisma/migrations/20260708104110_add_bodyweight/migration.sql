-- CreateTable
CREATE TABLE "Bodyweight" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "weight" REAL NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Bodyweight_date_key" ON "Bodyweight"("date");
