-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Passivo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorQuitacaoCentavos" INTEGER,
    "custoMensalCentavos" INTEGER,
    "custoMensalVariavel" BOOLEAN NOT NULL DEFAULT false,
    "estrutura" TEXT NOT NULL,
    "taxaJurosPct" REAL,
    "parcelaAtual" INTEGER,
    "totalParcelas" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "substituido" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "limiteCartaoCentavos" INTEGER,
    "metaGastoMensalCentavos" INTEGER,
    "documentoFonteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Passivo_documentoFonteId_fkey" FOREIGN KEY ("documentoFonteId") REFERENCES "Documento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Passivo" ("createdAt", "custoMensalCentavos", "custoMensalVariavel", "documentoFonteId", "estrutura", "id", "limiteCartaoCentavos", "metaGastoMensalCentavos", "nome", "observacao", "parcelaAtual", "status", "taxaJurosPct", "tipo", "totalParcelas", "updatedAt", "valorQuitacaoCentavos") SELECT "createdAt", "custoMensalCentavos", "custoMensalVariavel", "documentoFonteId", "estrutura", "id", "limiteCartaoCentavos", "metaGastoMensalCentavos", "nome", "observacao", "parcelaAtual", "status", "taxaJurosPct", "tipo", "totalParcelas", "updatedAt", "valorQuitacaoCentavos" FROM "Passivo";
DROP TABLE "Passivo";
ALTER TABLE "new_Passivo" RENAME TO "Passivo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
