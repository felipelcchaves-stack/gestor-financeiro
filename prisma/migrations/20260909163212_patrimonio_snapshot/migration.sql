-- CreateTable
CREATE TABLE "PatrimonioSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mesReferencia" TEXT NOT NULL,
    "patrimonioLiquidoCentavos" INTEGER NOT NULL,
    "ativoTotalCentavos" INTEGER NOT NULL,
    "passivoTotalCentavos" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PatrimonioSnapshot_mesReferencia_key" ON "PatrimonioSnapshot"("mesReferencia");
