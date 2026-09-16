-- AlterTable
ALTER TABLE "PassivoHistorico" ADD COLUMN "confiabilidade" TEXT;

-- CreateTable
CREATE TABLE "PassivoParcelaCronograma" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "passivoId" TEXT NOT NULL,
    "numeroParcela" INTEGER NOT NULL,
    "vencimento" DATETIME NOT NULL,
    "principalCentavos" INTEGER NOT NULL,
    "jurosCentavos" INTEGER NOT NULL,
    "valorParcelaCentavos" INTEGER NOT NULL,
    "saldoDevedorCentavos" INTEGER NOT NULL,
    "documentoId" TEXT,
    CONSTRAINT "PassivoParcelaCronograma_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PassivoParcelaCronograma_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PassivoParcelaCronograma_passivoId_numeroParcela_key" ON "PassivoParcelaCronograma"("passivoId", "numeroParcela");
