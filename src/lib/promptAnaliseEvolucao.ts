// Monta o prompt da análise de evolução mensal (botão no Mapa,
// src/app/(mapa)/page.tsx) — puramente narrativo, sem schema
// estruturado: aqui não tem corte de categoria pra validar contra
// protegida, é só "olhe a série real e me diga o que está
// acontecendo". Reaproveita listarDespesasPorCategoria
// (src/lib/promptCorteDeGastos.ts) só pro contexto do mês atual, sem
// duplicar essa formatação.

import { formatarBRL } from "@/lib/money";
import type { PontoEvolucaoMensal, MovimentacaoDoMes } from "@/lib/ofensores";
import { listarDespesasPorCategoria } from "@/lib/promptCorteDeGastos";

function nomeMes(mes: string): string {
  const [ano, mesNum] = mes.split("-").map(Number);
  return new Date(ano, mesNum - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function gerarPromptAnaliseEvolucao(pontos: PontoEvolucaoMensal[], movimentacaoDoMesAtual: MovimentacaoDoMes): string {
  const linhas: string[] = [];

  linhas.push(
    "Você é um consultor financeiro pessoal. Analise a evolução real de entradas e despesas mês a mês abaixo (dados reais, já calculados — não invente nem recalcule) e diga se a tendência geral é de melhora ou piora, com sugestões práticas pra melhorar a gestão."
  );
  linhas.push("");

  linhas.push("## Entradas x despesas por mês (histórico completo importado)");
  for (const p of pontos) {
    const saldo = p.entradasCentavos - p.despesasCentavos;
    linhas.push(
      `- ${nomeMes(p.mes)}: entradas ${formatarBRL(p.entradasCentavos)}, despesas ${formatarBRL(p.despesasCentavos)}, saldo ${formatarBRL(saldo)}`
    );
  }
  linhas.push("");

  linhas.push(`## Despesas do mês mais recente por categoria (total: ${formatarBRL(movimentacaoDoMesAtual.despesasTotalCentavos)})`);
  linhas.push(...listarDespesasPorCategoria(movimentacaoDoMesAtual));
  linhas.push("");

  linhas.push(
    "IMPORTANTE: categorias marcadas (PROTEGIDA) são fixas (ex: aluguel de onde mora) ou já tratadas por outro caminho (ex: já é o custo de uma dívida na rota de otimização) — NUNCA sugira cortar, renegociar, reduzir ou eliminar uma delas, mesmo de forma genérica ou como parte de uma lista maior. Se for citar uma categoria protegida, é só pra contextualizar o total gasto, nunca como uma ação recomendada."
  );
  linhas.push("");

  linhas.push(
    "Responda em português, em texto corrido (sem JSON, sem tabela): 1-2 parágrafos dizendo se a tendência é de melhora ou piora e por quê (cite meses e valores reais da série), seguido de até 4 sugestões práticas e específicas pra melhorar a gestão daqui pra frente — só em categorias não protegidas."
  );

  return linhas.join("\n");
}
