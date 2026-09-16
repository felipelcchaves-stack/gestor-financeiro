-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Categoria_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Categoria" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "saldoAtualCentavos" INTEGER,
    "saldoAtualizadoEm" DATETIME,
    "limiteChequeEspecialCentavos" INTEGER,
    "taxaJurosChequeEspecialPct" REAL,
    "carenciaDiasChequeEspecial" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Passivo" (
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
    "observacao" TEXT,
    "documentoFonteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Passivo_documentoFonteId_fkey" FOREIGN KEY ("documentoFonteId") REFERENCES "Documento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PassivoHistorico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "passivoId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNovo" TEXT NOT NULL,
    "motivo" TEXT,
    "documentoId" TEXT,
    "registradoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PassivoHistorico_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PassivoHistorico_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CicloFaturaPassivo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "passivoId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "valorMinimoCentavos" INTEGER,
    "vencimento" DATETIME,
    "documentoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CicloFaturaPassivo_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CicloFaturaPassivo_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ativo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "liquidez" TEXT NOT NULL,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AtivoHistorico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ativoId" TEXT NOT NULL,
    "valorAnteriorCentavos" INTEGER,
    "valorNovoCentavos" INTEGER NOT NULL,
    "registradoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AtivoHistorico_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AtivoPassivoVinculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ativoId" TEXT NOT NULL,
    "passivoId" TEXT NOT NULL,
    "tipoVinculo" TEXT NOT NULL,
    "observacao" TEXT,
    CONSTRAINT "AtivoPassivoVinculo_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AtivoPassivoVinculo_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "valorAlvoCentavos" INTEGER NOT NULL,
    "dataAlvo" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MetaPassivo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metaId" TEXT NOT NULL,
    "passivoId" TEXT NOT NULL,
    CONSTRAINT "MetaPassivo_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetaPassivo_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlocacaoMeta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metaId" TEXT NOT NULL,
    "transacaoId" TEXT,
    "valorCentavos" INTEGER NOT NULL,
    "data" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlocacaoMeta_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlocacaoMeta_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "Transacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecorrenciaFinanceira" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "frequencia" TEXT NOT NULL,
    "confiabilidade" TEXT NOT NULL,
    "observacao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "categoriaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecorrenciaFinanceira_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegraClassificacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "padraoDescricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "passivoId" TEXT,
    "ativoId" TEXT,
    "metaId" TEXT,
    "vezesConfirmada" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegraClassificacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RegraClassificacao_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegraClassificacao_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegraClassificacao_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transacao" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transacao_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_passivoId_fkey" FOREIGN KEY ("passivoId") REFERENCES "Passivo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transacao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrcamentoCategoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoriaId" TEXT NOT NULL,
    "limiteMensalCentavos" INTEGER NOT NULL,
    "referencia" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrcamentoCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomeArquivo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "caminhoArquivo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_parentId_key" ON "Categoria"("nome", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "CicloFaturaPassivo_passivoId_referencia_key" ON "CicloFaturaPassivo"("passivoId", "referencia");

-- CreateIndex
CREATE UNIQUE INDEX "AtivoPassivoVinculo_ativoId_passivoId_key" ON "AtivoPassivoVinculo"("ativoId", "passivoId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaPassivo_metaId_passivoId_key" ON "MetaPassivo"("metaId", "passivoId");

-- CreateIndex
CREATE UNIQUE INDEX "AlocacaoMeta_transacaoId_key" ON "AlocacaoMeta"("transacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "RegraClassificacao_padraoDescricao_key" ON "RegraClassificacao"("padraoDescricao");

-- CreateIndex
CREATE UNIQUE INDEX "Transacao_hashDedupe_key" ON "Transacao"("hashDedupe");

-- CreateIndex
CREATE UNIQUE INDEX "OrcamentoCategoria_categoriaId_referencia_key" ON "OrcamentoCategoria"("categoriaId", "referencia");
