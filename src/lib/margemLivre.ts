// Margem livre mensal (seção 4.3 do PRD): quanto sobra, todo mês, depois
// de cobrir obrigações fixas e o aporte já comprometido com quitação de
// dívida. Um valor perto de zero ou negativo é o mesmo padrão que
// originou a crise — por isso isso precisa aparecer destacado, não
// escondido numa tabela.

import { Confiabilidade, FrequenciaRecorrencia, TipoTransacao } from "@/generated/prisma";
import type { Passivo, RecorrenciaFinanceira } from "@/generated/prisma";

export type MargemLivre = {
  entradasConfirmadasCentavos: number;
  entradasEstimadasCentavos: number;
  despesasRecorrentesCentavos: number;
  custoMensalPassivosCentavos: number;
  aporteMensalExtraCentavos: number;
  // Fluxo do mês só com o que é fato: entradas confirmadas menos as saídas
  // conhecidas, sem contar nenhuma entrada estimada (PRD 4.4 — precisa
  // sempre distinguir visualmente o que é fato do que é estimativa).
  margemConfirmadaCentavos: number;
  // Inclui a entrada estimada — é a "projeção" do mês, não o fato confirmado.
  margemLivreCentavos: number;
};

export function calcularMargemLivre(input: {
  recorrencias: Pick<RecorrenciaFinanceira, "tipo" | "valorCentavos" | "frequencia" | "confiabilidade" | "ativa">[];
  passivosAtivos: Pick<Passivo, "custoMensalCentavos">[];
  aporteMensalExtraCentavos: number | null;
}): MargemLivre {
  const { recorrencias, passivosAtivos, aporteMensalExtraCentavos } = input;

  const mensaisAtivas = recorrencias.filter((r) => r.ativa && r.frequencia === FrequenciaRecorrencia.MENSAL);

  const somaPor = (tipo: TipoTransacao, confiabilidade?: Confiabilidade) =>
    mensaisAtivas
      .filter((r) => r.tipo === tipo && (confiabilidade == null || r.confiabilidade === confiabilidade))
      .reduce((acc, r) => acc + r.valorCentavos, 0);

  const entradasConfirmadasCentavos = somaPor(TipoTransacao.ENTRADA, Confiabilidade.CONFIRMADO);
  const entradasEstimadasCentavos = somaPor(TipoTransacao.ENTRADA, Confiabilidade.ESTIMADO);
  const despesasRecorrentesCentavos = somaPor(TipoTransacao.DESPESA);
  const custoMensalPassivosCentavos = passivosAtivos.reduce((acc, p) => acc + (p.custoMensalCentavos ?? 0), 0);
  const aporte = aporteMensalExtraCentavos ?? 0;
  const saidasConhecidasCentavos = despesasRecorrentesCentavos + custoMensalPassivosCentavos + aporte;

  const margemConfirmadaCentavos = entradasConfirmadasCentavos - saidasConhecidasCentavos;
  const margemLivreCentavos = margemConfirmadaCentavos + entradasEstimadasCentavos;

  return {
    entradasConfirmadasCentavos,
    entradasEstimadasCentavos,
    despesasRecorrentesCentavos,
    custoMensalPassivosCentavos,
    aporteMensalExtraCentavos: aporte,
    margemConfirmadaCentavos,
    margemLivreCentavos,
  };
}
