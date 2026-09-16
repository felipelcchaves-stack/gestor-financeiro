"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { prisma } from "@/lib/prisma";
import { parseFaturaTexto, parseLinhasFatura, type CandidatoFatura } from "@/lib/fatura-parser";
import { calcularHashDedupe, normalizarDescricao, sugerirClassificacao, calcularHistoricoPorValor } from "@/lib/classificacao";
import { confirmarLancamentoClassificado } from "@/lib/confirmarLancamento";
import { TipoTransacao, OrigemTransacao } from "@/generated/prisma";

const STORAGE_DIR = path.join(process.cwd(), "storage", "documentos");

export type CandidatoLancamentoRevisao = {
  data: string;
  descricao: string;
  valorCentavos: number;
  tipo: "DESPESA" | "ENTRADA";
  sugestao: {
    categoriaId: string | null;
    essencial: boolean;
    origem: "exata" | "aproximada" | "valor";
  } | null;
  parcelaSugerida: { atual: number; total: number } | null;
};

export type ResultadoAnaliseFatura = {
  documentoId: string;
  candidato: CandidatoFatura;
  lancamentos: CandidatoLancamentoRevisao[];
  duplicadosIgnorados: number;
  linhasNaoReconhecidas: string[];
};

export async function analisarFatura(formData: FormData): Promise<ResultadoAnaliseFatura> {
  const arquivo = formData.get("arquivo");
  const passivoId = formData.get("passivoId");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    throw new Error("Selecione o PDF da fatura.");
  }
  if (typeof passivoId !== "string" || passivoId.length === 0) {
    throw new Error("Selecione o cartão.");
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  await mkdir(STORAGE_DIR, { recursive: true });
  const nomeArmazenado = `${randomUUID()}.pdf`;
  await writeFile(path.join(STORAGE_DIR, nomeArmazenado), buffer);

  const documento = await prisma.documento.create({
    data: {
      nomeArquivo: arquivo.name,
      tipo: "fatura",
      caminhoArquivo: path.join("storage", "documentos", nomeArmazenado),
    },
  });

  const parser = new PDFParse({ data: buffer });
  const resultadoTexto = await parser.getText();
  await parser.destroy();

  const candidato = parseFaturaTexto(resultadoTexto.text);
  const { candidatos, linhasNaoReconhecidas } = parseLinhasFatura(resultadoTexto.text);

  const candidatosComHash = candidatos.map((c) => ({
    ...c,
    hash: calcularHashDedupe({
      origemId: passivoId,
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

  const lancamentos: CandidatoLancamentoRevisao[] = novos.map((c) => {
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
      sugestao: sugestao
        ? { categoriaId: sugestao.categoriaId, essencial: sugestao.essencial, origem: sugestao.origem }
        : null,
      parcelaSugerida: c.parcelaSugerida,
    };
  });

  return { documentoId: documento.id, candidato, lancamentos, duplicadosIgnorados, linhasNaoReconhecidas };
}

export type LancamentoFaturaParaConfirmar = {
  data: string;
  descricao: string;
  valorCentavos: number;
  tipo: "DESPESA" | "ENTRADA";
  categoriaId: string | null;
  essencial: boolean;
  parcelaAtual: number | null;
  totalParcelas: number | null;
};

export async function confirmarImportacaoFatura(params: {
  documentoId: string;
  passivoId: string;
  lancamentos: LancamentoFaturaParaConfirmar[];
}): Promise<{ importados: number; duplicadosNaConfirmacao: number }> {
  const { documentoId, passivoId, lancamentos } = params;
  let duplicadosNaConfirmacao = 0;

  for (const l of lancamentos) {
    const data = new Date(l.data);
    const tipo = l.tipo === "DESPESA" ? TipoTransacao.DESPESA : TipoTransacao.ENTRADA;
    const hashDedupe = calcularHashDedupe({
      origemId: passivoId,
      data,
      descricao: l.descricao,
      valorCentavos: l.valorCentavos,
    });

    const resultado = await confirmarLancamentoClassificado({
      data,
      descricao: l.descricao,
      valorCentavos: l.valorCentavos,
      tipo,
      origem: OrigemTransacao.FATURA_IMPORTADA,
      hashDedupe,
      documentoId,
      categoriaId: l.categoriaId,
      passivoId,
      essencial: l.essencial,
      parcelaAtual: l.parcelaAtual,
      totalParcelas: l.totalParcelas,
    });

    if (!resultado.criado) {
      duplicadosNaConfirmacao++;
    }
  }

  return { importados: lancamentos.length - duplicadosNaConfirmacao, duplicadosNaConfirmacao };
}
