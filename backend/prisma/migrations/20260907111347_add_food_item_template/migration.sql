-- CreateTable
CREATE TABLE "FoodItemTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "kcal" REAL NOT NULL,
    "protein" REAL NOT NULL,
    "carbs" REAL NOT NULL,
    "fat" REAL NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodItemTemplate_name_key" ON "FoodItemTemplate"("name");
