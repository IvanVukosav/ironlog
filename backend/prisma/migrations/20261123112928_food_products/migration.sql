-- CreateTable
CREATE TABLE "FoodProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "kcal" REAL NOT NULL,
    "protein" REAL NOT NULL,
    "carbs" REAL NOT NULL,
    "fat" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "packageSize" REAL,
    "servingSize" REAL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodProduct_barcode_key" ON "FoodProduct"("barcode");
