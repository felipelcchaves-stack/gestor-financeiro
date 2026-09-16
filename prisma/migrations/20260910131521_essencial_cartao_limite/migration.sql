-- AlterTable
ALTER TABLE "Passivo" ADD COLUMN "limiteCartaoCentavos" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecorrenciaFinanceira" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "frequencia" TEXT NOT NULL,
    "confiabilidade" TEXT NOT NULL,
    "observacao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "essencial" BOOLEAN NOT NULL DEFAULT false,
    "categoriaId" TEXT,
    "passivoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecorrenciaFinanceira_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecorrenciaFinanceira_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecorrenciaFinanceira" ("ativa", "categoriaId", "confiabilidade", "createdAt", "frequencia", "id", "nome", "observacao", "tipo", "valorCentavos") SELECT "ativa", "categoriaId", "confiabilidade", "createdAt", "frequencia", "id", "nome", "observacao", "tipo", "valorCentavos" FROM "RecorrenciaFinanceira";
DROP TABLE "RecorrenciaFinanceira";
ALTER TABLE "new_RecorrenciaFinanceira" RENAME TO "RecorrenciaFinanceira";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
