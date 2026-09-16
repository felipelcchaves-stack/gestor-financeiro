-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "aporteMensalExtraCentavos" INTEGER,
    "updatedAt" DATETIME NOT NULL
);
