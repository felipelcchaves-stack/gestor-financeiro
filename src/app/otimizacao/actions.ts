"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { intDoForm, textoDoForm } from "@/lib/form-helpers";
import { calcularMovimentacaoDoMes, inicioDoPeriodo } from "@/lib/ofensores";
import { nomesProtegidos } from "@/lib/promptCorteDeGastos";
import {
  gerarPromptRecomendacaoEstrategia,
  parseRecomendacaoEstrategia,
  RECOMENDACAO_ESTRATEGIA_SCHEMA,
  type ResumoEstrategiaParaIA,
  type RecomendacaoEstrategiaEstruturada,
} from "@/lib/promptRecomendacaoEstrategia";
import { chamarClaude } from "@/lib/claude";
import type { EstrategiaId } from "@/lib/otimizacao";

const ESTRATEGIAS_VALIDAS = ["menorTempo", "menorJuros", "maiorAlivio", "hibrida"];

export type ResultadoRecomendacaoIA = ({ ok: true } & RecomendacaoEstrategiaEstruturada) | { ok: false; erro: string };

// Fecha o loop entre "qual estratégia seguir" (já simulada no cliente,
// em OtimizacaoForm.tsx, com o motor de src/lib/otimizacao.ts — nunca
// recalculada aqui) e "de onde tirar o dinheiro" (mesmo raciocínio já
// usado em src/lib/promptCorteDeGastos.ts). Só os NÚMEROS já
// calculados vêm do cliente; os dados de categoria/gasto real são
// sempre buscados frescos aqui no servidor. Nunca lança exceção — ver
// o mesmo motivo em src/app/resumo/ia/actions.ts (Server Actions
// apagam a mensagem de erro lançado em produção).
export async function gerarRecomendacaoEstrategia(
  resumoEstrategias: ResumoEstrategiaParaIA[]
): Promise<ResultadoRecomendacaoIA> {
  try {
    if (resumoEstrategias.length === 0) {
      return { ok: false, erro: "Nenhuma estratégia simulada pra comparar ainda." };
    }

    const movimentacaoDoMes = await calcularMovimentacaoDoMes(inicioDoPeriodo("mes"));
    const prompt = gerarPromptRecomendacaoEstrategia(resumoEstrategias, movimentacaoDoMes);
    const textoJson = await chamarClaude(prompt, { schema: RECOMENDACAO_ESTRATEGIA_SCHEMA });

    const idsValidos = new Set<EstrategiaId>(resumoEstrategias.map((e) => e.id));
    const recomendacao = parseRecomendacaoEstrategia(textoJson, idsValidos, nomesProtegidos(movimentacaoDoMes));

    return { ok: true, ...recomendacao };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha desconhecida ao gerar a recomendação." };
  }
}

// Deixa explícito qual critério de ataque às dívidas o Felipe escolheu usar
// de verdade (em vez do sistema sempre impor "menor juro" silenciosamente)
// — propaga pra trilha do Mapa e pro gráfico de saldo por credor em
// /ofensores via src/lib/estadoAtual.ts.
export async function definirEstrategiaEscolhida(formData: FormData) {
  const estrategiaEscolhida = textoDoForm(formData, "estrategia");
  if (!estrategiaEscolhida || !ESTRATEGIAS_VALIDAS.includes(estrategiaEscolhida)) {
    throw new Error("Estratégia inválida.");
  }

  const splitHibridoPct = estrategiaEscolhida === "hibrida" ? intDoForm(formData, "splitHibridoPct") : null;

  await prisma.configuracao.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", estrategiaEscolhida, splitHibridoPct },
    update: { estrategiaEscolhida, splitHibridoPct },
  });

  revalidatePath("/");
  revalidatePath("/otimizacao");
  revalidatePath("/ofensores");
}
