-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN "categoriaRateioId" TEXT;
ALTER TABLE "Configuracao" ADD COLUMN "contaRateioDestinoId" TEXT;
ALTER TABLE "Configuracao" ADD COLUMN "percentualRateio" INTEGER;
ALTER TABLE "Configuracao" ADD COLUMN "rateioAtivoDesde" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "valorAlvoCentavos" INTEGER NOT NULL,
    "dataAlvo" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "contaOrigemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meta_contaOrigemId_fkey" FOREIGN KEY ("contaOrigemId") REFERENCES "Conta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Meta" ("createdAt", "dataAlvo", "id", "nome", "status", "updatedAt", "valorAlvoCentavos") SELECT "createdAt", "dataAlvo", "id", "nome", "status", "updatedAt", "valorAlvoCentavos" FROM "Meta";
DROP TABLE "Meta";
ALTER TABLE "new_Meta" RENAME TO "Meta";
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
    "contaDestinoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transacao_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_contaDestinoId_fkey" FOREIGN KEY ("contaDestinoId") REFERENCES "Conta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transacao" ("ativoId", "categoriaId", "contaId", "createdAt", "data", "descricao", "documentoId", "ehTransferencia", "hashDedupe", "id", "origem", "parcelaAtual", "passivoId", "saldoAposCentavos", "tipo", "totalParcelas", "valorCentavos") SELECT "ativoId", "categoriaId", "contaId", "createdAt", "data", "descricao", "documentoId", "ehTransferencia", "hashDedupe", "id", "origem", "parcelaAtual", "passivoId", "saldoAposCentavos", "tipo", "totalParcelas", "valorCentavos" FROM "Transacao";
DROP TABLE "Transacao";
ALTER TABLE "new_Transacao" RENAME TO "Transacao";
CREATE UNIQUE INDEX "Transacao_hashDedupe_key" ON "Transacao"("hashDedupe");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
