-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AtivoPassivoVinculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ativoId" TEXT NOT NULL,
    "passivoId" TEXT NOT NULL,
    "tipoVinculo" TEXT NOT NULL DEFAULT 'GARANTIA',
    "observacao" TEXT,
    CONSTRAINT "AtivoPassivoVinculo_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AtivoPassivoVinculo_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AtivoPassivoVinculo" ("ativoId", "id", "observacao", "passivoId", "tipoVinculo") SELECT "ativoId", "id", "observacao", "passivoId", "tipoVinculo" FROM "AtivoPassivoVinculo";
DROP TABLE "AtivoPassivoVinculo";
ALTER TABLE "new_AtivoPassivoVinculo" RENAME TO "AtivoPassivoVinculo";
CREATE UNIQUE INDEX "AtivoPassivoVinculo_ativoId_passivoId_key" ON "AtivoPassivoVinculo"("ativoId", "passivoId");
CREATE TABLE "new_Transacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" DATETIME NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "saldoAposCentavos" INTEGER,
    "tipo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "contaId" TEXT,
    "categoriaId" TEXT,
    "passivoId" TEXT,
    "ativoId" TEXT,
    "documentoId" TEXT,
    "hashDedupe" TEXT,
    "parcelaAtual" INTEGER,
    "totalParcelas" INTEGER,
    "ehTransferencia" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transacao_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transacao" ("ativoId", "categoriaId", "contaId", "createdAt", "data", "descricao", "documentoId", "hashDedupe", "id", "origem", "parcelaAtual", "passivoId", "saldoAposCentavos", "tipo", "totalParcelas", "valorCentavos") SELECT "ativoId", "categoriaId", "contaId", "createdAt", "data", "descricao", "documentoId", "hashDedupe", "id", "origem", "parcelaAtual", "passivoId", "saldoAposCentavos", "tipo", "totalParcelas", "valorCentavos" FROM "Transacao";
DROP TABLE "Transacao";
ALTER TABLE "new_Transacao" RENAME TO "Transacao";
CREATE UNIQUE INDEX "Transacao_hashDedupe_key" ON "Transacao"("hashDedupe");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
