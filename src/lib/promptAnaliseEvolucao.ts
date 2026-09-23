// Monta o prompt da análise de evolução mensal (botão no Mapa,
// src/app/(mapa)/page.tsx) e o schema de saída estruturada — mesmo
// mecanismo de tool-use forçado já usado em SUGESTAO_CORTE_SCHEMA
// (src/lib/promptCorteDeGastos.ts), trocado de texto corrido pra
// campos separados (tendência / ações prioritárias / pontos de
// atenção com dica / pontos positivos) porque um parágrafo único
// misturando tudo ficava difícil de escanear e não dava pra pedir uma
// dica por ponto de atenção sem virar mais um parágrafo solto.
// Reaproveita listarDespesasPorCategoria (src/lib/promptCorteDeGastos.ts)
// só pro contexto do mês atual, sem duplicar essa formatação.

import { formatarBRL } from "@/lib/money";
import type { PontoEvolucaoMensal, MovimentacaoDoMes } from "@/lib/ofensores";
import { listarDespesasPorCategoria } from "@/lib/promptCorteDeGastos";

export type PontoAtencaoEvolucao = { item: string; dica: string };

export type AnaliseEvolucaoEstruturada = {
  tendencia: string;
  acoesPrioritarias: string[];
  pontosAtencao: PontoAtencaoEvolucao[];
  pontosPositivos: string[];
};

// JSON Schema — usado como `input_schema` de uma tool forçada na API
// do Claude (src/lib/claude.ts), mesmo padrão de SUGESTAO_CORTE_SCHEMA.
export const ANALISE_EVOLUCAO_SCHEMA = {
  type: "object",
  properties: {
    tendencia: {
      type: "string",
      description:
        "1-2 parágrafos em português dizendo se a tendência geral é de melhora ou piora e por quê, citando meses e valores reais da série. O mês marcado (PROJETADO), se houver, nunca deve ser citado aqui como fato consumado — só como expectativa.",
    },
    acoesPrioritarias: {
      type: "array",
      items: { type: "string" },
      description:
        "Até 4 ações práticas e específicas pra melhorar a gestão daqui pra frente, em ordem de prioridade (a primeira é a mais urgente). Só em categorias não protegidas. Cada item é uma frase curta e direta, sem numeração no próprio texto (ex: 'Congelar novos gastos no cartão X').",
    },
    pontosAtencao: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: {
            type: "string",
            description: "Um gasto, categoria ou padrão preocupante identificado nos dados (frase curta).",
          },
          dica: {
            type: "string",
            description: "Uma dica prática e específica de como melhorar esse ponto — não repita o problema, complete com a ação.",
          },
        },
        required: ["item", "dica"],
      },
      description: "Pontos de atenção reais nos dados (gasto alto, categoria crescendo, saldo negativo etc), cada um já com sua dica de melhoria.",
    },
    pontosPositivos: {
      type: "array",
      items: { type: "string" },
      description:
        "Pontos genuinamente positivos identificados nos dados (ex: mês com saldo positivo, categoria que caiu). Se não houver nenhum de verdade, devolva um array vazio — nunca invente um ponto positivo só pra preencher.",
    },
  },
  required: ["tendencia", "acoesPrioritarias", "pontosAtencao", "pontosPositivos"],
};

function nomeMes(mes: string): string {
  const [ano, mesNum] = mes.split("-").map(Number);
  return new Date(ano, mesNum - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function gerarPromptAnaliseEvolucao(pontos: PontoEvolucaoMensal[], movimentacaoDoMesAtual: MovimentacaoDoMes): string {
  const linhas: string[] = [];

  linhas.push(
    "Você é um consultor financeiro pessoal. Analise a evolução de entradas e despesas mês a mês abaixo (dados já calculados — não invente nem recalcule)."
  );
  linhas.push("");

  linhas.push("## Entradas x despesas por mês (histórico completo importado)");
  for (const p of pontos) {
    const saldo = p.entradasCentavos - p.despesasCentavos;
    const marcadorProjetado = p.projetado
      ? " (PROJETADO — calculado a partir de renda e despesa recorrente, parcela mínima de dívida e parcelas de compras já parceladas no cartão com cobrança sabida pra esse mês, todas já cadastradas/documentadas no sistema; ainda não é fato, ninguém fechou esse mês)"
      : "";
    linhas.push(
      `- ${nomeMes(p.mes)}: entradas ${formatarBRL(p.entradasCentavos)}, despesas ${formatarBRL(p.despesasCentavos)}, saldo ${formatarBRL(saldo)}${marcadorProjetado}`
    );
  }
  linhas.push("");

  if (pontos.some((p) => p.projetado)) {
    linhas.push(
      "IMPORTANTE: o mês marcado (PROJETADO) acima é uma estimativa, não um fato consumado — NUNCA fale dele como algo que já aconteceu, já foi fechado ou já está garantido. Trate-o sempre como expectativa (ex: \"a projeção para o próximo mês indica...\") e não o misture com os meses reais ao descrever a tendência observada até aqui."
    );
    linhas.push("");
  }

  linhas.push(`## Despesas do mês mais recente por categoria (total: ${formatarBRL(movimentacaoDoMesAtual.despesasTotalCentavos)})`);
  linhas.push(...listarDespesasPorCategoria(movimentacaoDoMesAtual));
  linhas.push("");

  linhas.push(
    "IMPORTANTE: categorias marcadas (PROTEGIDA) são fixas (ex: aluguel de onde mora) ou já tratadas por outro caminho (ex: já é o custo de uma dívida na rota de otimização) — NUNCA sugira cortar, renegociar, reduzir ou eliminar uma delas, mesmo de forma genérica ou como parte de uma lista maior, nem em `acoesPrioritarias` nem em `pontosAtencao`. Se for citar uma categoria protegida, é só pra contextualizar o total gasto, nunca como uma ação recomendada."
  );
  linhas.push("");

  linhas.push("Responda preenchendo os campos pedidos: `tendencia`, `acoesPrioritarias`, `pontosAtencao` (cada um com `item` e `dica`) e `pontosPositivos`.");

  return linhas.join("\n");
}

// JSON.parse + validação de formato da resposta do Claude, e filtro
// defensivo: remove qualquer ação prioritária ou ponto de atenção cujo
// texto mencione (case-insensitive, substring — aqui são frases
// livres, não um nome exato de categoria) uma categoria protegida,
// caso o modelo ignore a instrução do prompt. Já aconteceu de verdade
// nessa mesma função antes (a resposta citou "Esmeraldino", uma
// categoria protegida) quando a saída era texto livre sem como
// filtrar — com campos estruturados dá pra filtrar de verdade, mesmo
// espírito de parseSugestaoCorte (src/lib/promptCorteDeGastos.ts).
export function parseAnaliseEvolucao(textoJson: string, protegidos: Set<string>): AnaliseEvolucaoEstruturada {
  let dados: unknown;
  try {
    dados = JSON.parse(textoJson);
  } catch {
    throw new Error("Resposta do Claude veio num formato inesperado (não é JSON válido) — tente de novo.");
  }

  if (
    typeof dados !== "object" ||
    dados === null ||
    typeof (dados as Record<string, unknown>).tendencia !== "string" ||
    !Array.isArray((dados as Record<string, unknown>).acoesPrioritarias) ||
    !Array.isArray((dados as Record<string, unknown>).pontosAtencao) ||
    !Array.isArray((dados as Record<string, unknown>).pontosPositivos)
  ) {
    throw new Error("Resposta do Claude veio sem o formato esperado — tente de novo.");
  }

  const bruto = dados as {
    tendencia: string;
    acoesPrioritarias: unknown[];
    pontosAtencao: unknown[];
    pontosPositivos: unknown[];
  };

  const mencionaProtegida = (texto: string) => {
    const minusculo = texto.toLowerCase();
    for (const nome of protegidos) {
      if (minusculo.includes(nome)) return true;
    }
    return false;
  };

  const acoesPrioritarias = bruto.acoesPrioritarias
    .filter((a): a is string => typeof a === "string")
    .filter((a) => !mencionaProtegida(a));

  const pontosAtencao = bruto.pontosAtencao
    .filter(
      (p): p is { item: string; dica: string } =>
        typeof p === "object" && p !== null && typeof (p as Record<string, unknown>).item === "string" && typeof (p as Record<string, unknown>).dica === "string"
    )
    .filter((p) => !mencionaProtegida(p.item));

  const pontosPositivos = bruto.pontosPositivos.filter((p): p is string => typeof p === "string");

  return { tendencia: bruto.tendencia, acoesPrioritarias, pontosAtencao, pontosPositivos };
}
