// Fecha o elo que faltava entre o extrato importado e o saldo documentado
// de um passivo: sem isso, o saldo só muda quando o Felipe edita o passivo
// manualmente, mesmo que ele já tenha pago de verdade via transações
// vinculadas — Otimização, Consultor e a trilha do Mapa continuam olhando
// pro número antigo.
//
// Conta nos dois sentidos: uma DESPESA vinculada é pagamento (reduz o
// saldo devedor); uma ENTRADA vinculada é desembolso de empréstimo — o
// dinheiro entrou na conta de verdade, mas não é receita, é dívida nova
// (aumenta o saldo devedor). Sem isso, um desembolso vinculado seria
// silenciosamente ignorado (ou pior, seria tratado como progresso).

import { prisma } from "@/lib/prisma";
import { TipoTransacao } from "@/generated/prisma";

export type ReconciliacaoPassivo = {
  dataUltimaAtualizacao: Date;
  pagoDesdeUltimaAtualizacaoCentavos: number;
  desembolsadoDesdeUltimaAtualizacaoCentavos: number;
  saldoAtualDocumentadoCentavos: number | null;
  // Só existe quando há saldo documentado E alguma movimentação vinculada
  // que de fato muda o saldo desde a última atualização — nunca inventa
  // uma sugestão do nada.
  saldoSugeridoCentavos: number | null;
  // true quando o passivo é SO_JUROS_SEM_AMORTIZACAO (Agiota e afins) e o
  // valor pago é real mas não atingiu o saldo total documentado — nesse
  // tipo de dívida o pagamento mensal é só juro, não abate o principal;
  // só uma quitação total (pago >= saldo) reduz o saldo. A UI usa isso
  // pra explicar por que o saldo sugerido não muda mesmo com pagamento
  // vinculado.
  pagamentoEhSoJuroSemAbaterPrincipal: boolean;
};

export async function calcularReconciliacaoPassivo(passivoId: string): Promise<ReconciliacaoPassivo | null> {
  const passivo = await prisma.passivo.findUnique({ where: { id: passivoId } });
  if (!passivo) return null;

  const ultimaAtualizacao = await prisma.passivoHistorico.findFirst({
    where: { passivoId, campo: "valorQuitacaoCentavos" },
    orderBy: { registradoEm: "desc" },
  });

  const dataUltimaAtualizacao = ultimaAtualizacao?.registradoEm ?? passivo.createdAt;

  const [pagamentos, desembolsos] = await Promise.all([
    prisma.transacao.aggregate({
      where: { passivoId, tipo: TipoTransacao.DESPESA, data: { gte: dataUltimaAtualizacao } },
      _sum: { valorCentavos: true },
    }),
    prisma.transacao.aggregate({
      where: { passivoId, tipo: TipoTransacao.ENTRADA, data: { gte: dataUltimaAtualizacao } },
      _sum: { valorCentavos: true },
    }),
  ]);

  const pagoDesdeUltimaAtualizacaoCentavos = pagamentos._sum.valorCentavos ?? 0;
  const desembolsadoDesdeUltimaAtualizacaoCentavos = desembolsos._sum.valorCentavos ?? 0;

  // Empréstimo "só juro, sem amortização" (Agiota e afins) não dá crédito
  // parcial: o motor de simulação (src/lib/otimizacao.ts) já trata isso
  // como binário — o saldo só zera quando o valor acumulado atinge o
  // total, tudo de uma vez. A reconciliação precisa da mesma regra, senão
  // sugeriria abater o principal com pagamento que é só juro.
  const ehSoJurosSemAmortizacao = passivo.estrutura === "SO_JUROS_SEM_AMORTIZACAO";
  const quitacaoTotalAtingida =
    passivo.valorQuitacaoCentavos != null && pagoDesdeUltimaAtualizacaoCentavos >= passivo.valorQuitacaoCentavos;
  const pagamentoEhSoJuroSemAbaterPrincipal =
    ehSoJurosSemAmortizacao && pagoDesdeUltimaAtualizacaoCentavos > 0 && !quitacaoTotalAtingida;

  const reducaoPorPagamentoCentavos = pagamentoEhSoJuroSemAbaterPrincipal ? 0 : pagoDesdeUltimaAtualizacaoCentavos;
  const movimentacaoMudaSaldo = reducaoPorPagamentoCentavos > 0 || desembolsadoDesdeUltimaAtualizacaoCentavos > 0;

  return {
    dataUltimaAtualizacao,
    pagoDesdeUltimaAtualizacaoCentavos,
    desembolsadoDesdeUltimaAtualizacaoCentavos,
    saldoAtualDocumentadoCentavos: passivo.valorQuitacaoCentavos,
    saldoSugeridoCentavos:
      passivo.valorQuitacaoCentavos != null && movimentacaoMudaSaldo
        ? Math.max(0, passivo.valorQuitacaoCentavos - reducaoPorPagamentoCentavos + desembolsadoDesdeUltimaAtualizacaoCentavos)
        : null,
    pagamentoEhSoJuroSemAbaterPrincipal,
  };
}
