// Monta o prompt pra sugestão de corte de gastos (Gemini) — só números
// agregados por categoria, nunca a lista de transações individuais.
// Reaproveita exatamente os mesmos cálculos que já alimentam
// /relatorio/categorias e /consultor, não inventa nada novo.

import { formatarBRL } from "@/lib/money";
import type { EstadoAtual } from "@/lib/estadoAtual";
import type { MovimentacaoDoMes } from "@/lib/ofensores";
import type { StatusRateio } from "@/lib/rateio";

// Alvo específico pra sugestão "corte agressivo pra fechar essa meta
// mais rápido" (botão em /cofre). Deliberadamente SEM ritmo necessário
// nem data-alvo — o Felipe já rejeitou essa framing explicitamente
// ("não posso conviver com esse passivo por muito tempo"): ele quer o
// corte mais agressivo plausível, não uma meta lenta baseada em prazo.
export type MetaAlvoPrompt = {
  nome: string;
  saldoCentavos: number;
  custoMensalCentavos: number | null;
  saldoJaSeparadoCentavos: number;
};

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
  linhas.push("Regras: use só as categorias listadas abaixo — nunca invente categoria, valor ou dívida que não esteja aqui.");
  linhas.push("");

  linhas.push(`## Despesas deste mês por categoria (total: ${formatarBRL(movimentacaoDoMes.despesasTotalCentavos)})`);
  for (const c of movimentacaoDoMes.despesasPorCategoria) {
    linhas.push(`- ${c.nome}: ${formatarBRL(c.totalCentavos)}`);
  }
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
      "Essa dívida está drenando o caixa agora — não existe um prazo confortável pra ela, o objetivo é quitar o quanto antes, não seguir um ritmo lento. Seja agressivo: liste o máximo de corte plausível por categoria (não se limite a um valor mínimo ou conservador), some o total que isso libera por mês e, considerando o saldo já separado, diga em quantos meses esse total adicional fecharia o que falta pra quitar essa dívida específica."
    );
    linhas.push(
      "Responda em português. Use só as categorias e a dívida listadas acima — nunca invente categoria, valor ou dívida que não esteja aqui."
    );
  } else {
    linhas.push(
      "Responda em português, em até 6 sugestões, cada uma com o valor exato em reais que ela libera por mês e pra qual dívida (pelo nome documentado acima) esse valor deveria ir primeiro."
    );
  }

  return linhas.join("\n");
}
