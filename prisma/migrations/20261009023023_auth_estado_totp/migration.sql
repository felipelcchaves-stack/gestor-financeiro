-- CreateTable
CREATE TABLE "AuthEstado" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "emergenciaUltimoContador" INTEGER,
    "updatedAt" DATETIME NOT NULL
);
