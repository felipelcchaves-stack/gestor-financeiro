"use server";

import { prisma } from "@/lib/prisma";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularMovimentacaoDoMes, inicioDoPeriodo } from "@/lib/ofensores";
import { calcularStatusRateio } from "@/lib/rateio";
import {
  gerarPromptCorteDeGastos,
  parseSugestaoCorte,
  nomesProtegidos,
  achatarDespesasPorCategoria,
  compararComAnalise,
  SUGESTAO_CORTE_SCHEMA,
  type CorteSugerido,
  type ComparacaoAnalise,
} from "@/lib/promptCorteDeGastos";
import type { Projecao } from "@/lib/projecaoMeta";
import { chamarClaude } from "@/lib/claude";

export type { CorteSugerido, Projecao, ComparacaoAnalise };

// `projecao` só existe pra sugestão de uma meta específica (tem
// saldo-alvo pra comparar, ver src/lib/projecaoMeta.ts) — a sugestão
// geral (essa página) fica com `projecao: null`. `comparacao` é
// congelada no momento da geração (não recalculada ao reabrir "Ver
// última análise") — ver src/lib/promptCorteDeGastos.ts.
export type SugestaoGerada = {
  resumo: string;
  cortes: CorteSugerido[];
  geradoEm: string;
  projecao: Projecao | null;
  comparacao: ComparacaoAnalise | null;
};

export type ResultadoSugestaoIA = ({ ok: true } & SugestaoGerada) | { ok: false; erro: string };

// Id fixo da linha "geral" no cache — mesmo padrão do singleton de
// Configuracao. As sugestões por meta (src/app/cofre/actions.ts) usam
// metaId único em vez de um id fixo.
const ID_CACHE_GERAL = "geral-resumo-ia";

// Nunca lança exceção pra fora — em produção, o Next.js apaga a
// mensagem de um erro lançado numa Server Action por segurança (só
// manda um código genérico pro cliente, tipo "Minified React error
// #441"), então qualquer `throw` aqui vira uma tela ilegível mesmo
// com try/catch do lado do cliente. Sempre devolvendo um objeto
// normal, a mensagem real chega inteira, sempre.
export async function gerarSugestaoCorteIA(): Promise<ResultadoSugestaoIA> {
  try {
    const estado = await carregarEstadoAtual();
    const [movimentacaoDoMes, statusRateio, anterior] = await Promise.all([
      calcularMovimentacaoDoMes(inicioDoPeriodo("mes")),
      calcularStatusRateio(estado),
      prisma.sugestaoIACache.findUnique({ where: { id: ID_CACHE_GERAL } }),
    ]);

    const comparacao = compararComAnalise(
      anterior?.despesasPorCategoriaJson,
      anterior?.geradoEm,
      movimentacaoDoMes.despesasPorCategoria
    );

    const prompt = gerarPromptCorteDeGastos(estado, movimentacaoDoMes, statusRateio, undefined, comparacao);
    const textoJson = await chamarClaude(prompt, { schema: SUGESTAO_CORTE_SCHEMA });
    const { resumo, cortes } = parseSugestaoCorte(textoJson, nomesProtegidos(movimentacaoDoMes));

    const geradoEm = new Date();
    const despesasPorCategoriaJson = JSON.stringify(achatarDespesasPorCategoria(movimentacaoDoMes.despesasPorCategoria));
    const comparacaoJson = JSON.stringify(comparacao);
    await prisma.sugestaoIACache.upsert({
      where: { id: ID_CACHE_GERAL },
      create: { id: ID_CACHE_GERAL, resumo, cortesJson: JSON.stringify(cortes), despesasPorCategoriaJson, comparacaoJson, geradoEm },
      update: { resumo, cortesJson: JSON.stringify(cortes), despesasPorCategoriaJson, comparacaoJson, geradoEm },
    });

    return { ok: true, resumo, cortes, geradoEm: geradoEm.toISOString(), projecao: null, comparacao };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha desconhecida ao gerar a sugestão." };
  }
}

export async function obterUltimaSugestaoGeral(): Promise<SugestaoGerada | null> {
  const row = await prisma.sugestaoIACache.findUnique({ where: { id: ID_CACHE_GERAL } });
  if (!row) return null;
  return {
    resumo: row.resumo,
    cortes: JSON.parse(row.cortesJson),
    geradoEm: row.geradoEm.toISOString(),
    projecao: null,
    comparacao: row.comparacaoJson ? JSON.parse(row.comparacaoJson) : null,
  };
}
