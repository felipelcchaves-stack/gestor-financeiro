"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularEvolucaoMensal, calcularMovimentacaoDoMes, inicioDoPeriodo } from "@/lib/ofensores";
import { gerarPromptAnaliseEvolucao } from "@/lib/promptAnaliseEvolucao";
import { chamarClaude } from "@/lib/claude";
import { Confiabilidade } from "@/generated/prisma";

export type AnaliseEvolucao = { resumo: string; geradoEm: string };
export type ResultadoAnaliseEvolucao = ({ ok: true } & AnaliseEvolucao) | { ok: false; erro: string };

// Id fixo na mesma tabela de cache usada pelas outras sugestões de IA
// (SugestaoIACache, ver src/app/resumo/ia/actions.ts) — nenhuma
// migração nova, `cortesJson` fica um array vazio porque essa análise
// não tem lista de corte, só narrativa.
const ID_CACHE_ANALISE_EVOLUCAO = "analise-evolucao-mapa";

// Botão "Pedir análise da IA" no gráfico de evolução do Mapa — mesmo
// formato nunca-lança-exceção de sempre (Server Actions apagam a
// mensagem de erro lançado em produção).
export async function gerarAnaliseEvolucao(): Promise<ResultadoAnaliseEvolucao> {
  try {
    const [pontos, movimentacaoDoMesAtual] = await Promise.all([
      calcularEvolucaoMensal(inicioDoPeriodo("tudo")),
      calcularMovimentacaoDoMes(inicioDoPeriodo("mes")),
    ]);
    if (pontos.length === 0) {
      return { ok: false, erro: "Sem transação importada ainda pra analisar — importe um extrato primeiro." };
    }

    const prompt = gerarPromptAnaliseEvolucao(pontos, movimentacaoDoMesAtual);
    const resumo = await chamarClaude(prompt);

    const geradoEm = new Date();
    await prisma.sugestaoIACache.upsert({
      where: { id: ID_CACHE_ANALISE_EVOLUCAO },
      create: { id: ID_CACHE_ANALISE_EVOLUCAO, resumo, cortesJson: "[]", geradoEm },
      update: { resumo, cortesJson: "[]", geradoEm },
    });

    return { ok: true, resumo, geradoEm: geradoEm.toISOString() };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha desconhecida ao gerar a análise." };
  }
}

export async function obterUltimaAnaliseEvolucao(): Promise<AnaliseEvolucao | null> {
  const row = await prisma.sugestaoIACache.findUnique({ where: { id: ID_CACHE_ANALISE_EVOLUCAO } });
  if (!row) return null;
  return { resumo: row.resumo, geradoEm: row.geradoEm.toISOString() };
}

export async function definirAporteMensal(formData: FormData) {
  const aporteMensalExtraCentavos = centavosDoForm(formData, "aporte");
  if (aporteMensalExtraCentavos == null || aporteMensalExtraCentavos <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }

  await prisma.configuracao.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", aporteMensalExtraCentavos },
    update: { aporteMensalExtraCentavos },
  });

  revalidatePath("/");
  revalidatePath("/otimizacao");
}

export async function registrarSnapshotMensal() {
  const estado = await carregarEstadoAtual();
  const mesReferencia = estado.hoje.toISOString().slice(0, 7);

  await prisma.patrimonioSnapshot.upsert({
    where: { mesReferencia },
    create: {
      mesReferencia,
      patrimonioLiquidoCentavos: estado.patrimonio,
      ativoTotalCentavos: estado.ativoTotal,
      passivoTotalCentavos: estado.passivoTotal,
    },
    update: {
      patrimonioLiquidoCentavos: estado.patrimonio,
      ativoTotalCentavos: estado.ativoTotal,
      passivoTotalCentavos: estado.passivoTotal,
    },
  });

  revalidatePath("/");
  revalidatePath("/resumo");
}

// Documenta um mês PASSADO de memória — nunca calculado pelo sistema,
// sempre o número que o Felipe digitar. Existe pra não travar a
// evolução da dívida em um único ponto por meses só porque o botão de
// snapshot mensal só grava o mês corrente. Sempre marcado ESTIMADO, pra
// nunca se confundir com um snapshot calculado dos dados documentados.
export async function registrarSnapshotHistorico(formData: FormData) {
  const mesReferencia = textoDoForm(formData, "mesReferencia");
  const passivoTotalCentavos = centavosDoForm(formData, "passivoTotal");
  const ativoTotalCentavos = centavosDoForm(formData, "ativoTotal") ?? 0;

  if (mesReferencia == null || !/^\d{4}-\d{2}$/.test(mesReferencia)) {
    throw new Error("Informe um mês válido.");
  }
  if (passivoTotalCentavos == null || passivoTotalCentavos < 0) {
    throw new Error("Informe a dívida total daquele mês.");
  }

  const mesAtual = new Date().toISOString().slice(0, 7);
  if (mesReferencia >= mesAtual) {
    throw new Error("Use o botão \"Registrar patrimônio deste mês\" pro mês corrente — este campo é só pra meses passados.");
  }

  const existente = await prisma.patrimonioSnapshot.findUnique({ where: { mesReferencia } });
  if (existente) {
    throw new Error("Já existe um snapshot registrado pra esse mês.");
  }

  await prisma.patrimonioSnapshot.create({
    data: {
      mesReferencia,
      passivoTotalCentavos,
      ativoTotalCentavos,
      patrimonioLiquidoCentavos: ativoTotalCentavos - passivoTotalCentavos,
      confiabilidade: Confiabilidade.ESTIMADO,
    },
  });

  revalidatePath("/");
  revalidatePath("/resumo");
}
