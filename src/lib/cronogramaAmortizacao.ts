// Usa o cronograma real de parcelas de um contrato (hoje só os 6
// consignados Itaú, ver PassivoParcelaCronograma) pra duas coisas:
// (1) o preview de quitar/amortizar com uma transação vinculada, e
// (2) estimar em que parcela o contrato já deveria estar pela data,
// quando nada foi confirmado.
//
// Importante: só usamos o Principal de cada parcela do cronograma pra
// calcular o novo saldo — nunca a coluna "saldo devedor atual" do PDF,
// que não representa o saldo total do empréstimo (ver comentário no
// schema em PassivoParcelaCronograma). O novo saldo é sempre
// "saldo documentado atual do passivo − soma do Principal das parcelas
// confirmadas/estimadas" — nunca inventa um número novo do zero.

import type { PassivoParcelaCronograma } from "@/generated/prisma";

export type ParcelaPendente = {
  numeroParcela: number;
  vencimento: Date;
  principalCentavos: number;
  jurosCentavos: number;
  valorParcelaCentavos: number;
};

// Parcelas do cronograma com vencimento já passado, mas ainda não
// confirmadas (numeroParcela > parcelaAtual do passivo) — a base tanto
// pro preview de quitar/amortizar quanto pra estimativa sem confirmação.
export function parcelasPendentesPorData(
  cronograma: PassivoParcelaCronograma[],
  parcelaAtual: number,
  hoje: Date
): ParcelaPendente[] {
  return cronograma
    .filter((c) => c.numeroParcela > parcelaAtual && c.vencimento <= hoje)
    .sort((a, b) => a.numeroParcela - b.numeroParcela)
    .map((c) => ({
      numeroParcela: c.numeroParcela,
      vencimento: c.vencimento,
      principalCentavos: c.principalCentavos,
      jurosCentavos: c.jurosCentavos,
      valorParcelaCentavos: c.valorParcelaCentavos,
    }));
}

// A próxima parcela ainda não confirmada, independente de já ter
// vencido ou não — usada no preview de quitar/amortizar quando o
// Felipe vincula uma transação real de pagamento.
export function proximaParcela(
  cronograma: PassivoParcelaCronograma[],
  parcelaAtual: number
): ParcelaPendente | null {
  const proxima = cronograma
    .filter((c) => c.numeroParcela > parcelaAtual)
    .sort((a, b) => a.numeroParcela - b.numeroParcela)[0];
  if (!proxima) return null;
  return {
    numeroParcela: proxima.numeroParcela,
    vencimento: proxima.vencimento,
    principalCentavos: proxima.principalCentavos,
    jurosCentavos: proxima.jurosCentavos,
    valorParcelaCentavos: proxima.valorParcelaCentavos,
  };
}

export type EstimativaCronograma = {
  parcelasPendentes: ParcelaPendente[];
  novaParcelaAtual: number;
  principalAcumuladoCentavos: number;
  saldoEstimadoCentavos: number;
};

// Soma o Principal de todas as parcelas já vencidas e não confirmadas,
// e abate isso do saldo JÁ documentado — nunca dos R$0 nem de uma
// fórmula recalculada do zero. Retorna null quando não há nada vencido
// pendente (nada a estimar).
export function calcularEstimativaCronograma(
  cronograma: PassivoParcelaCronograma[],
  parcelaAtual: number,
  saldoDocumentadoCentavos: number,
  hoje: Date
): EstimativaCronograma | null {
  const pendentes = parcelasPendentesPorData(cronograma, parcelaAtual, hoje);
  if (pendentes.length === 0) return null;

  const principalAcumuladoCentavos = pendentes.reduce((s, p) => s + p.principalCentavos, 0);
  return {
    parcelasPendentes: pendentes,
    novaParcelaAtual: pendentes[pendentes.length - 1].numeroParcela,
    principalAcumuladoCentavos,
    saldoEstimadoCentavos: Math.max(0, saldoDocumentadoCentavos - principalAcumuladoCentavos),
  };
}
