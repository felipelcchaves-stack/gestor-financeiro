// Monta o prompt que fecha o loop entre "qual estratégia de ataque
// seguir" (já simulada com números reais em /otimizacao, ver
// src/lib/otimizacao.ts) e "de onde tirar o dinheiro pra bancar isso"
// (mesmo raciocínio de src/lib/promptCorteDeGastos.ts). O Claude nunca
// recebe a trajetória mês-a-mês nem inventa outro critério — só os
// totais já calculados por nós, e escolhe entre eles.

import { formatarBRL } from "@/lib/money";
import type { MovimentacaoDoMes } from "@/lib/ofensores";
import type { EstrategiaId } from "@/lib/otimizacao";
import { listarDespesasPorCategoria, type CorteSugerido } from "@/lib/promptCorteDeGastos";

export type ResumoEstrategiaParaIA = {
  id: EstrategiaId;
  titulo: string;
  mesesTotais: number;
  jurosTotalCentavos: number;
  mesesAteAlivioVisivel: number | null;
  mesesNoEscuroTotal: number;
};

export type RecomendacaoEstrategiaEstruturada = {
  estrategiaRecomendada: EstrategiaId;
  motivo: string;
  cortes: CorteSugerido[];
};

export const RECOMENDACAO_ESTRATEGIA_SCHEMA = {
  type: "object",
  properties: {
    estrategiaRecomendada: {
      type: "string",
      enum: ["menorTempo", "menorJuros", "maiorAlivio", "hibrida"],
      description: "Exatamente um dos ids de estratégia listados no prompt — nunca um id fora da lista dada.",
    },
    motivo: {
      type: "string",
      description:
        "Por que essa estratégia é a melhor pro perfil real dele — cite os números reais das estratégias comparadas, não genérico.",
    },
    cortes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          categoria: { type: "string", description: "Nome exato de uma categoria/subcategoria listada no prompt." },
          valorLiberadoReais: { type: "number", description: "Valor em reais (não centavos) liberado por mês com esse corte." },
          justificativa: { type: "string" },
        },
        required: ["categoria", "valorLiberadoReais"],
      },
      description: "Cortes que viabilizariam um aporte mensal maior — vazio se o aporte atual já parecer adequado.",
    },
  },
  required: ["estrategiaRecomendada", "motivo", "cortes"],
};

export function gerarPromptRecomendacaoEstrategia(
  estrategias: ResumoEstrategiaParaIA[],
  movimentacaoDoMes: MovimentacaoDoMes
): string {
  const linhas: string[] = [];

  linhas.push(
    "Você é um consultor financeiro pessoal. Compare as estratégias de ataque a dívida já simuladas abaixo (números reais, já calculados — não recalcule) e recomende qual delas faz mais sentido pro perfil de gasto real dele."
  );
  linhas.push(
    "Importante: quitar uma dívida pequena inteira e amortizar parcialmente uma dívida grande são os dois resultados bons — não assuma que 'quitar' é sempre melhor que 'amortizar'. Julgue pelos números reais de cada estratégia."
  );
  linhas.push("");

  linhas.push("## Estratégias simuladas (números reais)");
  for (const e of estrategias) {
    linhas.push(
      `- ${e.id} (${e.titulo}): ${e.mesesTotais} meses até quitar tudo, ${formatarBRL(e.jurosTotalCentavos)} de juro total pago, 1º alívio visível no mês ${e.mesesAteAlivioVisivel ?? "nunca"}, ${e.mesesNoEscuroTotal} meses-dívida "no escuro" (sem nenhum progresso visível, só juro).`
    );
  }
  linhas.push("");

  linhas.push(`## Despesas deste mês por categoria (total: ${formatarBRL(movimentacaoDoMes.despesasTotalCentavos)})`);
  linhas.push(
    "Regras: use só as categorias/subcategorias listadas abaixo — nunca invente. Categorias-raiz com subcategorias NUNCA devem ser cortadas inteiras — corte só na subcategoria específica, nunca numa marcada como PROTEGIDA."
  );
  linhas.push(...listarDespesasPorCategoria(movimentacaoDoMes));
  linhas.push("");

  linhas.push(
    "Responda só em JSON, no formato pedido: `estrategiaRecomendada` (o id exato de uma das estratégias listadas acima), `motivo` (citando os números reais que justificam a escolha) e `cortes` (categorias/subcategorias não protegidas que liberariam caixa pra um aporte maior — pode vir vazio se não fizer sentido sugerir corte agora)."
  );

  return linhas.join("\n");
}

// Mesmo princípio de src/lib/promptCorteDeGastos.ts: JSON.parse +
// validação de formato + filtro defensivo de categoria protegida, e
// também valida que a estratégia recomendada é uma das que foram
// realmente oferecidas (nunca uma inventada pelo modelo).
export function parseRecomendacaoEstrategia(
  textoJson: string,
  idsValidos: Set<EstrategiaId>,
  protegidos: Set<string>
): RecomendacaoEstrategiaEstruturada {
  let dados: unknown;
  try {
    dados = JSON.parse(textoJson);
  } catch {
    throw new Error("Resposta do Claude veio num formato inesperado (não é JSON válido) — tente de novo.");
  }

  const bruto = dados as Record<string, unknown>;
  if (
    typeof dados !== "object" ||
    dados === null ||
    typeof bruto.estrategiaRecomendada !== "string" ||
    typeof bruto.motivo !== "string" ||
    !Array.isArray(bruto.cortes)
  ) {
    throw new Error("Resposta do Claude veio sem o formato esperado — tente de novo.");
  }

  if (!idsValidos.has(bruto.estrategiaRecomendada as EstrategiaId)) {
    throw new Error("O Claude recomendou uma estratégia que não estava entre as comparadas — tente de novo.");
  }

  const cortes: CorteSugerido[] = (bruto.cortes as unknown[])
    .filter(
      (c): c is { categoria: string; valorLiberadoReais: number; justificativa?: string } =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).categoria === "string" &&
        typeof (c as Record<string, unknown>).valorLiberadoReais === "number"
    )
    .filter((c) => !protegidos.has(c.categoria.toLowerCase()));

  return {
    estrategiaRecomendada: bruto.estrategiaRecomendada as EstrategiaId,
    motivo: bruto.motivo,
    cortes,
  };
}
