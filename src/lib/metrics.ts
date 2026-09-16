import { EstruturaPassivo, type Ativo, type Meta, type Passivo } from "@/generated/prisma";

export function somaPassivosConhecidos(passivos: Pick<Passivo, "valorQuitacaoCentavos">[]): number {
  return passivos.reduce((acc, p) => acc + (p.valorQuitacaoCentavos ?? 0), 0);
}

export function contarPassivosSemValorDocumentado(
  passivos: Pick<Passivo, "valorQuitacaoCentavos">[]
): number {
  return passivos.filter((p) => p.valorQuitacaoCentavos == null).length;
}

export function segmentarPorEstrutura(
  passivos: Pick<Passivo, "estrutura" | "valorQuitacaoCentavos">[]
) {
  const porEstrutura = (estrutura: EstruturaPassivo) =>
    somaPassivosConhecidos(passivos.filter((p) => p.estrutura === estrutura));

  return {
    sangriaAtiva: porEstrutura(EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO),
    amortizando: porEstrutura(EstruturaPassivo.AMORTIZA_NORMAL),
    semSangria: porEstrutura(EstruturaPassivo.SEM_JUROS),
  };
}

export function somaAtivos(ativos: Pick<Ativo, "valorCentavos">[]): number {
  return ativos.reduce((acc, a) => acc + a.valorCentavos, 0);
}

export function patrimonioLiquido(
  ativos: Pick<Ativo, "valorCentavos">[],
  passivos: Pick<Passivo, "valorQuitacaoCentavos">[]
): number {
  return somaAtivos(ativos) - somaPassivosConhecidos(passivos);
}

export function mesesEntre(hoje: Date, alvo: Date): number {
  const diffMs = alvo.getTime() - hoje.getTime();
  const dias = diffMs / (1000 * 60 * 60 * 24);
  return dias / 30.44;
}

export type ProgressoMeta = {
  valorFaltanteCentavos: number;
  alocadoCentavos: number;
  mesesRestantes: number;
  ritmoNecessarioCentavos: number | null;
  temDadosDeAlocacao: boolean;
};

export function calcularProgressoMeta(
  meta: Pick<Meta, "valorAlvoCentavos" | "dataAlvo">,
  passivosAlvo: Pick<Passivo, "valorQuitacaoCentavos">[],
  alocacoes: { valorCentavos: number }[],
  hoje: Date = new Date()
): ProgressoMeta {
  const valoresConhecidos = passivosAlvo.filter((p) => p.valorQuitacaoCentavos != null);
  const valorFaltanteCentavos =
    valoresConhecidos.length > 0
      ? somaPassivosConhecidos(valoresConhecidos)
      : meta.valorAlvoCentavos;

  const alocadoCentavos = alocacoes.reduce((acc, a) => acc + a.valorCentavos, 0);
  const mesesRestantes = Math.max(mesesEntre(hoje, meta.dataAlvo), 0);

  return {
    valorFaltanteCentavos,
    alocadoCentavos,
    mesesRestantes,
    ritmoNecessarioCentavos:
      mesesRestantes > 0 ? Math.round(valorFaltanteCentavos / mesesRestantes) : null,
    temDadosDeAlocacao: alocacoes.length > 0,
  };
}
