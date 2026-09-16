// Quando um Ativo (investimento) serve de GARANTIA pra um Passivo, e a
// dívida custa mais juro por mês do que o investimento rende, manter
// aquele pedaço "preso" em vez de resgatar e quitar a dívida é dinheiro
// perdido todo mês — de propósito, sem inventar rendimento nenhum: só
// calcula quando os dois lados (rendimentoMensalPct do ativo e
// taxaJurosPct do passivo) já estão documentados. Nunca decide resgatar
// nada sozinho — só mostra o número; a ação continua manual, pelo fluxo
// de Quitar/Amortizar que já existe.

export type VinculoParaArbitragem = {
  tipoVinculo: string;
  valorGarantidoCentavos: number | null;
  passivo: {
    id: string;
    nome: string;
    status: string;
    taxaJurosPct: number | null;
  };
};

export type AtivoParaArbitragem = {
  id: string;
  nome: string;
  rendimentoMensalPct: number | null;
  vinculos: VinculoParaArbitragem[];
};

export type OportunidadeArbitragem = {
  passivoId: string;
  passivoNome: string;
  taxaJurosPct: number;
  valorGarantidoCentavos: number;
  custoMensalCentavos: number;
};

export type ArbitragemAtivo = {
  ativoId: string;
  ativoNome: string;
  rendimentoMensalPct: number;
  custoMensalTotalCentavos: number;
  oportunidades: OportunidadeArbitragem[];
};

export function calcularArbitragemGarantia(ativos: AtivoParaArbitragem[]): ArbitragemAtivo[] {
  const resultado: ArbitragemAtivo[] = [];

  for (const ativo of ativos) {
    if (ativo.rendimentoMensalPct == null) continue;
    const rendimento = ativo.rendimentoMensalPct;

    const oportunidades: OportunidadeArbitragem[] = ativo.vinculos
      .filter((v) => v.tipoVinculo === "GARANTIA" && v.passivo.status === "ATIVO")
      .filter((v): v is VinculoParaArbitragem & { valorGarantidoCentavos: number; passivo: { taxaJurosPct: number } & VinculoParaArbitragem["passivo"] } =>
        v.valorGarantidoCentavos != null && v.passivo.taxaJurosPct != null
      )
      .map((v) => {
        const diferencaPct = v.passivo.taxaJurosPct - rendimento;
        return {
          passivoId: v.passivo.id,
          passivoNome: v.passivo.nome,
          taxaJurosPct: v.passivo.taxaJurosPct,
          valorGarantidoCentavos: v.valorGarantidoCentavos,
          custoMensalCentavos: Math.round((v.valorGarantidoCentavos * diferencaPct) / 100),
        };
      })
      .filter((o) => o.custoMensalCentavos > 0)
      .sort((a, b) => b.custoMensalCentavos - a.custoMensalCentavos);

    if (oportunidades.length === 0) continue;

    resultado.push({
      ativoId: ativo.id,
      ativoNome: ativo.nome,
      rendimentoMensalPct: rendimento,
      custoMensalTotalCentavos: oportunidades.reduce((soma, o) => soma + o.custoMensalCentavos, 0),
      oportunidades,
    });
  }

  return resultado.sort((a, b) => b.custoMensalTotalCentavos - a.custoMensalTotalCentavos);
}
