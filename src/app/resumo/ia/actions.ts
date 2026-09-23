"use server";

import { prisma } from "@/lib/prisma";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularMovimentacaoDoMes, inicioDoPeriodo } from "@/lib/ofensores";
import { calcularStatusRateio } from "@/lib/rateio";
import { gerarPromptCorteDeGastos, parseSugestaoCorte, nomesProtegidos, SUGESTAO_CORTE_SCHEMA, type CorteSugerido } from "@/lib/promptCorteDeGastos";
import type { Projecao } from "@/lib/projecaoMeta";
import { chamarGemini } from "@/lib/gemini";

export type { CorteSugerido, Projecao };

// `projecao` só existe pra sugestão de uma meta específica (tem
// saldo-alvo pra comparar, ver src/lib/projecaoMeta.ts) — a sugestão
// geral (essa página) fica com `projecao: null`.
export type SugestaoGerada = { resumo: string; cortes: CorteSugerido[]; geradoEm: string; projecao: Projecao | null };

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
    const [movimentacaoDoMes, statusRateio] = await Promise.all([
      calcularMovimentacaoDoMes(inicioDoPeriodo("mes")),
      calcularStatusRateio(estado),
    ]);

    const prompt = gerarPromptCorteDeGastos(estado, movimentacaoDoMes, statusRateio);
    const textoJson = await chamarGemini(prompt, { schema: SUGESTAO_CORTE_SCHEMA });
    const { resumo, cortes } = parseSugestaoCorte(textoJson, nomesProtegidos(movimentacaoDoMes));

    const geradoEm = new Date();
    await prisma.sugestaoIACache.upsert({
      where: { id: ID_CACHE_GERAL },
      create: { id: ID_CACHE_GERAL, resumo, cortesJson: JSON.stringify(cortes), geradoEm },
      update: { resumo, cortesJson: JSON.stringify(cortes), geradoEm },
    });

    return { ok: true, resumo, cortes, geradoEm: geradoEm.toISOString(), projecao: null };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha desconhecida ao gerar a sugestão." };
  }
}

export async function obterUltimaSugestaoGeral(): Promise<SugestaoGerada | null> {
  const row = await prisma.sugestaoIACache.findUnique({ where: { id: ID_CACHE_GERAL } });
  if (!row) return null;
  return { resumo: row.resumo, cortes: JSON.parse(row.cortesJson), geradoEm: row.geradoEm.toISOString(), projecao: null };
}
