"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import "pdf-parse/worker"; // precisa vir antes do import abaixo
import { PDFParse } from "pdf-parse";
import { prisma } from "@/lib/prisma";
import { parseExtratoTexto } from "@/lib/extrato-parser";
import { calcularHashDedupe, normalizarDescricao, sugerirClassificacao, calcularHistoricoPorValor } from "@/lib/classificacao";
import { confirmarLancamentoClassificado } from "@/lib/confirmarLancamento";
import { TipoTransacao, OrigemTransacao } from "@/generated/prisma";

const STORAGE_DIR = path.join(process.cwd(), "storage", "documentos");

export type CandidatoRevisao = {
  data: string;
  descricao: string;
  valorCentavos: number;
  tipo: "DESPESA" | "ENTRADA";
  saldoAposCentavos: number | null;
  sugestao: {
    categoriaId: string | null;
    vinculoTipo: "PASSIVO" | "ATIVO" | "META" | null;
    vinculoId: string | null;
    essencial: boolean;
    origem: "exata" | "aproximada" | "valor";
  } | null;
};

export type ResultadoAnalise = {
  documentoId: string;
  candidatos: CandidatoRevisao[];
  duplicadosIgnorados: number;
  linhasNaoReconhecidas: string[];
  resumosDiariosIgnorados: number;
  saldoDetectado: { data: string; valorCentavos: number } | null;
};

export async function analisarExtrato(formData: FormData): Promise<ResultadoAnalise> {
  const arquivo = formData.get("arquivo");
  const contaId = formData.get("contaId");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    throw new Error("Selecione um arquivo PDF.");
  }
  if (typeof contaId !== "string" || contaId.length === 0) {
    throw new Error("Selecione a conta do extrato.");
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  await mkdir(STORAGE_DIR, { recursive: true });
  const nomeArmazenado = `${randomUUID()}.pdf`;
  await writeFile(path.join(STORAGE_DIR, nomeArmazenado), buffer);

  const documento = await prisma.documento.create({
    data: {
      nomeArquivo: arquivo.name,
      tipo: "extrato",
      caminhoArquivo: path.join("storage", "documentos", nomeArmazenado),
    },
  });

  const parser = new PDFParse({ data: buffer });
  const resultadoTexto = await parser.getText();
  await parser.destroy();

  const { candidatos, linhasNaoReconhecidas, resumosDiariosIgnorados, saldoDetectado } = parseExtratoTexto(
    resultadoTexto.text
  );

  const candidatosComHash = candidatos.map((c) => ({
    ...c,
    hash: calcularHashDedupe({
      origemId: contaId,
      data: new Date(c.data),
      descricao: c.descricao,
      valorCentavos: c.valorCentavos,
    }),
  }));

  const jaExistentes = await prisma.transacao.findMany({
    where: { hashDedupe: { in: candidatosComHash.map((c) => c.hash) } },
    select: { hashDedupe: true },
  });
  const hashesExistentes = new Set(jaExistentes.map((t) => t.hashDedupe));

  const novos = candidatosComHash.filter((c) => !hashesExistentes.has(c.hash));
  const duplicadosIgnorados = candidatosComHash.length - novos.length;

  const [regras, recorrencias, historicoPorValor] = await Promise.all([
    prisma.regraClassificacao.findMany(),
    prisma.recorrenciaFinanceira.findMany(),
    calcularHistoricoPorValor(),
  ]);

  const candidatosRevisao: CandidatoRevisao[] = novos.map((c) => {
    const sugestao = sugerirClassificacao({
      descricaoNormalizada: normalizarDescricao(c.descricao),
      regras,
      recorrencias,
      valorCentavos: c.valorCentavos,
      tipoCandidato: c.tipoSugerido === "DESPESA" ? TipoTransacao.DESPESA : TipoTransacao.ENTRADA,
      historicoPorValor,
    });
    return {
      data: c.data,
      descricao: c.descricao,
      valorCentavos: c.valorCentavos,
      tipo: sugestao?.tipo === TipoTransacao.DESPESA ? "DESPESA" : sugestao?.tipo === TipoTransacao.ENTRADA ? "ENTRADA" : c.tipoSugerido,
      saldoAposCentavos: c.saldoAposCentavos,
      sugestao: sugestao
        ? {
            categoriaId: sugestao.categoriaId,
            vinculoTipo: sugestao.passivoId ? "PASSIVO" : sugestao.ativoId ? "ATIVO" : sugestao.metaId ? "META" : null,
            vinculoId: sugestao.passivoId ?? sugestao.ativoId ?? sugestao.metaId ?? null,
            essencial: sugestao.essencial,
            origem: sugestao.origem,
          }
        : null,
    };
  });

  return {
    documentoId: documento.id,
    candidatos: candidatosRevisao,
    duplicadosIgnorados,
    linhasNaoReconhecidas,
    resumosDiariosIgnorados,
    saldoDetectado,
  };
}

export type LancamentoParaConfirmar = {
  data: string;
  descricao: string;
  valorCentavos: number;
  tipo: "DESPESA" | "ENTRADA";
  saldoAposCentavos: number | null;
  categoriaId: string | null;
  vinculoTipo: "NENHUM" | "PASSIVO" | "ATIVO" | "META";
  vinculoId: string | null;
  essencial: boolean;
  ehTransferencia: boolean;
  contaDestinoId: string | null;
};

export async function confirmarImportacaoExtrato(params: {
  documentoId: string;
  contaId: string;
  lancamentos: LancamentoParaConfirmar[];
  saldoDetectado?: { data: string; valorCentavos: number } | null;
}): Promise<{ importados: number; duplicadosNaConfirmacao: number }> {
  const { documentoId, contaId, lancamentos, saldoDetectado } = params;

  let ultimaData: Date | null = saldoDetectado ? new Date(saldoDetectado.data) : null;
  let ultimoSaldo: number | null = saldoDetectado ? saldoDetectado.valorCentavos : null;
  let duplicadosNaConfirmacao = 0;

  for (const l of lancamentos) {
    const data = new Date(l.data);
    const tipo = l.tipo === "DESPESA" ? TipoTransacao.DESPESA : TipoTransacao.ENTRADA;
    const hashDedupe = calcularHashDedupe({
      origemId: contaId,
      data,
      descricao: l.descricao,
      valorCentavos: l.valorCentavos,
    });

    const resultado = await confirmarLancamentoClassificado({
      data,
      descricao: l.descricao,
      valorCentavos: l.valorCentavos,
      tipo,
      origem: OrigemTransacao.EXTRATO_IMPORTADO,
      hashDedupe,
      documentoId,
      categoriaId: l.categoriaId,
      contaId,
      passivoId: l.vinculoTipo === "PASSIVO" ? l.vinculoId : null,
      ativoId: l.vinculoTipo === "ATIVO" ? l.vinculoId : null,
      metaId: l.vinculoTipo === "META" ? l.vinculoId : null,
      saldoAposCentavos: l.saldoAposCentavos,
      essencial: l.essencial,
      ehTransferencia: l.ehTransferencia,
      contaDestinoId: l.contaDestinoId || null,
    });

    // Duas linhas do mesmo extrato com conta+dia+descrição+valor idênticos batem na
    // mesma "impressão digital" de dedupe (hashDedupe é @unique) — pode ser um
    // lançamento realmente repetido no dia ou uma linha que o parser leu em
    // duplicidade. Em vez de travar a importação inteira, conta como duplicata
    // (mesmo tratamento que já damos a duplicatas de importações anteriores, só
    // que descobertas agora em vez de na tela de revisão) e segue pro resto do lote.
    if (!resultado.criado) {
      duplicadosNaConfirmacao++;
    }

    if (l.saldoAposCentavos != null && (ultimaData == null || data >= ultimaData)) {
      ultimaData = data;
      ultimoSaldo = l.saldoAposCentavos;
    }
  }

  if (ultimoSaldo != null && ultimaData != null) {
    const conta = await prisma.conta.findUnique({ where: { id: contaId } });
    if (!conta?.saldoAtualizadoEm || ultimaData >= conta.saldoAtualizadoEm) {
      await prisma.conta.update({
        where: { id: contaId },
        data: { saldoAtualCentavos: ultimoSaldo, saldoAtualizadoEm: ultimaData },
      });
    }
  }

  return { importados: lancamentos.length - duplicadosNaConfirmacao, duplicadosNaConfirmacao };
}
