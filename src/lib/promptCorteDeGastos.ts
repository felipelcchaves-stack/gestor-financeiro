// Monta o prompt pra sugestão de corte de gastos (Gemini) — só números
// agregados por categoria (raiz + subcategoria), nunca a lista de
// transações individuais. Reaproveita exatamente os mesmos cálculos
// que já alimentam /relatorio/categorias e /consultor, não inventa
// nada novo.

import { formatarBRL } from "@/lib/money";
import type { EstadoAtual } from "@/lib/estadoAtual";
import type { MovimentacaoDoMes } from "@/lib/ofensores";
import type { StatusRateio } from "@/lib/rateio";

// Alvo específico pra sugestão "corte agressivo pra fechar essa meta
// mais rápido" (botão em /cofre). Deliberadamente SEM ritmo necessário
// nem data-alvo — o Felipe já rejeitou essa framing explicitamente
// ("não posso conviver com esse passivo por muito tempo"): ele quer o
// corte mais agressivo plausível, não uma meta lenta baseada em prazo.
// Também não pedimos pra IA calcular "em quantos meses fecha" — isso é
// feito com matemática nossa (soma dos cortes reais + saldo real do
// cofre), não confiado à conta do modelo (ver gerarSugestaoParaMeta).
export type MetaAlvoPrompt = {
  nome: string;
  saldoCentavos: number;
  custoMensalCentavos: number | null;
  saldoJaSeparadoCentavos: number;
};

export type CorteSugerido = { categoria: string; valorLiberadoReais: number; justificativa?: string };

export type SugestaoCorteEstruturada = { resumo: string; cortes: CorteSugerido[] };

// Formato aceito pelo `generationConfig.responseSchema` do Gemini
// (subconjunto de OpenAPI) — força a resposta a vir só em JSON, nesse
// formato exato, em vez de confiar em regex sobre texto livre.
export const SUGESTAO_CORTE_SCHEMA = {
  type: "object",
  properties: {
    resumo: {
      type: "string",
      description: "Narrativa em português: contexto, prioridade entre os cortes, conclusão. Não repita os cortes em tabela aqui — eles vão em `cortes`.",
    },
    cortes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          categoria: { type: "string", description: "Nome exato de uma categoria ou subcategoria listada no prompt." },
          valorLiberadoReais: { type: "number", description: "Valor em reais (não centavos) liberado por mês com esse corte." },
          justificativa: { type: "string" },
        },
        required: ["categoria", "valorLiberadoReais"],
      },
    },
  },
  required: ["resumo", "cortes"],
};

function listarDespesasPorCategoria(movimentacaoDoMes: MovimentacaoDoMes): string[] {
  const linhas: string[] = [];
  for (const c of movimentacaoDoMes.despesasPorCategoria) {
    const marcaRaiz = c.protegida ? " (PROTEGIDA — não sugerir corte aqui)" : "";
    linhas.push(`- ${c.nome}: ${formatarBRL(c.totalCentavos)}${marcaRaiz}`);
    for (const sub of c.subcategorias) {
      const marcaSub = sub.protegida ? " (PROTEGIDA — não sugerir corte aqui)" : "";
      linhas.push(`  - ${sub.nome}: ${formatarBRL(sub.totalCentavos)}${marcaSub}`);
    }
  }
  return linhas;
}

// Nomes (case-insensitive) de tudo que está marcado como protegido —
// usado tanto pra montar o aviso no prompt quanto pro filtro defensivo
// em parseSugestaoCorte (caso o modelo ignore a instrução).
export function nomesProtegidos(movimentacaoDoMes: MovimentacaoDoMes): Set<string> {
  const nomes = new Set<string>();
  for (const c of movimentacaoDoMes.despesasPorCategoria) {
    if (c.protegida) nomes.add(c.nome.toLowerCase());
    for (const sub of c.subcategorias) {
      if (sub.protegida) nomes.add(sub.nome.toLowerCase());
    }
  }
  return nomes;
}

export function gerarPromptCorteDeGastos(
  estado: EstadoAtual,
  movimentacaoDoMes: MovimentacaoDoMes,
  statusRateio: StatusRateio | null,
  metaAlvo?: MetaAlvoPrompt
): string {
  const linhas: string[] = [];

  linhas.push(
    "Você é um consultor financeiro pessoal. Analise os dados reais abaixo e sugira cortes de gasto CONCRETOS, em reais, pra liberar caixa pra quitar dívida mais rápido."
  );
  linhas.push(
    "Regras: use só as categorias/subcategorias listadas abaixo — nunca invente categoria, valor ou dívida que não esteja aqui. Categorias-raiz com subcategorias listadas NUNCA devem ser cortadas inteiras — corte só na subcategoria específica. Nunca sugira corte numa categoria ou subcategoria marcada como PROTEGIDA, mesmo que pareça um bom valor a liberar — ela é fixa (ex: aluguel de onde mora) ou já é tratada por outro caminho (ex: já é o custo de uma dívida na rota de quitação)."
  );
  linhas.push("");

  linhas.push(`## Despesas deste mês por categoria (total: ${formatarBRL(movimentacaoDoMes.despesasTotalCentavos)})`);
  linhas.push(...listarDespesasPorCategoria(movimentacaoDoMes));
  linhas.push("");

  linhas.push("## Dívidas ativas (custo mensal documentado)");
  for (const p of estado.passivosAtivos) {
    const custo = p.custoMensalCentavos != null ? formatarBRL(p.custoMensalCentavos) : "não documentado";
    const taxa = p.taxaJurosPct != null ? `${p.taxaJurosPct}% a.m.` : "taxa não documentada";
    linhas.push(`- ${p.nome}: ${custo}/mês, ${taxa}, estrutura ${p.estrutura}`);
  }
  linhas.push("");

  linhas.push(`## Margem livre mensal atual: ${formatarBRL(estado.margemLivre.margemLivreCentavos)}`);
  linhas.push(
    `## Aporte mensal extra configurado hoje: ${estado.configuracao?.aporteMensalExtraCentavos != null ? formatarBRL(estado.configuracao.aporteMensalExtraCentavos) : "não configurado"}`
  );
  linhas.push("");

  if (statusRateio) {
    linhas.push(
      `## Cofre de dívida: ${formatarBRL(statusRateio.contaDestinoSaldoCentavos ?? 0)} disponíveis em ${statusRateio.contaDestinoNome} (rateio de ${statusRateio.percentual}% de ${statusRateio.categoriaNome})`
    );
    linhas.push("");
  }

  if (metaAlvo) {
    linhas.push(
      `## Objetivo: fechar "${metaAlvo.nome}" o mais rápido possível (saldo a quitar: ${formatarBRL(metaAlvo.saldoCentavos)}${metaAlvo.custoMensalCentavos != null ? `, custo mensal ${formatarBRL(metaAlvo.custoMensalCentavos)}` : ""}; já separado: ${formatarBRL(metaAlvo.saldoJaSeparadoCentavos)})`
    );
    linhas.push("");
    linhas.push(
      "Essa dívida está drenando o caixa agora — não existe um prazo confortável pra ela, o objetivo é quitar o quanto antes, não seguir um ritmo lento. Seja agressivo: liste o máximo de corte plausível por categoria/subcategoria não protegida (não se limite a um valor mínimo ou conservador)."
    );
  }

  linhas.push(
    "Responda só em JSON, no formato pedido: `resumo` (texto corrido em português — contexto, prioridade entre os cortes, conclusão, sem repetir os cortes em tabela) e `cortes` (lista de {categoria, valorLiberadoReais, justificativa}), usando exatamente os nomes de categoria/subcategoria listados acima."
  );

  return linhas.join("\n");
}

// JSON.parse + validação de formato da resposta do Gemini, e filtro
// defensivo: remove qualquer corte cujo nome bata (case-insensitive)
// com uma categoria protegida, caso o modelo ignore a instrução do
// prompt — decisão financeira não pode depender só de "o modelo
// prometeu que ia respeitar".
export function parseSugestaoCorte(textoJson: string, protegidos: Set<string>): SugestaoCorteEstruturada {
  let dados: unknown;
  try {
    dados = JSON.parse(textoJson);
  } catch {
    throw new Error("Resposta do Gemini veio num formato inesperado (não é JSON válido) — tente de novo.");
  }

  if (
    typeof dados !== "object" ||
    dados === null ||
    typeof (dados as Record<string, unknown>).resumo !== "string" ||
    !Array.isArray((dados as Record<string, unknown>).cortes)
  ) {
    throw new Error("Resposta do Gemini veio sem o formato esperado (resumo/cortes) — tente de novo.");
  }

  const bruto = dados as { resumo: string; cortes: unknown[] };
  const cortes: CorteSugerido[] = bruto.cortes
    .filter(
      (c): c is { categoria: string; valorLiberadoReais: number; justificativa?: string } =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).categoria === "string" &&
        typeof (c as Record<string, unknown>).valorLiberadoReais === "number"
    )
    .filter((c) => !protegidos.has(c.categoria.toLowerCase()));

  return { resumo: bruto.resumo, cortes };
}
