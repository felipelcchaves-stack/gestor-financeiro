// Monta o prompt pra sugestão de corte de gastos (Gemini) — só números
// agregados por categoria, nunca a lista de transações individuais.
// Reaproveita exatamente os mesmos cálculos que já alimentam
// /relatorio/categorias e /consultor, não inventa nada novo.

import { formatarBRL } from "@/lib/money";
import type { EstadoAtual } from "@/lib/estadoAtual";
import type { MovimentacaoDoMes } from "@/lib/ofensores";
import type { StatusRateio } from "@/lib/rateio";

export function gerarPromptCorteDeGastos(
  estado: EstadoAtual,
  movimentacaoDoMes: MovimentacaoDoMes,
  statusRateio: StatusRateio | null
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

  linhas.push(
    "Responda em português, em até 6 sugestões, cada uma com o valor exato em reais que ela libera por mês e pra qual dívida (pelo nome documentado acima) esse valor deveria ir primeiro."
  );

  return linhas.join("\n");
}
