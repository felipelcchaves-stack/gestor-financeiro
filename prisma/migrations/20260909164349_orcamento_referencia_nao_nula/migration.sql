-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrcamentoCategoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoriaId" TEXT NOT NULL,
    "limiteMensalCentavos" INTEGER NOT NULL,
    "referencia" TEXT NOT NULL DEFAULT 'recorrente',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrcamentoCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrcamentoCategoria" ("categoriaId", "createdAt", "id", "limiteMensalCentavos", "referencia") SELECT "categoriaId", "createdAt", "id", "limiteMensalCentavos", coalesce("referencia", 'recorrente') AS "referencia" FROM "OrcamentoCategoria";
DROP TABLE "OrcamentoCategoria";
ALTER TABLE "new_OrcamentoCategoria" RENAME TO "OrcamentoCategoria";
CREATE UNIQUE INDEX "OrcamentoCategoria_categoriaId_referencia_key" ON "OrcamentoCategoria"("categoriaId", "referencia");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
