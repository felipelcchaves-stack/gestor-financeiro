// Matemática pura em torno de "meta do cofre + corte sugerido" — vive
// fora de um arquivo "use server" de propósito: essas funções não são
// Server Actions (não fazem I/O), e todo export de um módulo "use
// server" precisa ser async (regra do Next.js) — colocar aqui evita
// esse conflito e deixa o cálculo reaproveitável tanto de dentro de
// uma Server Action (src/app/cofre/actions.ts) quanto direto num
// Server Component (src/app/cofre/page.tsx, pra recalcular a projeção
// de uma sugestão já cacheada sem outra chamada ao Claude).

import type { Passivo } from "@/generated/prisma";
import type { CorteSugerido } from "@/lib/promptCorteDeGastos";

export type Projecao = {
  totalLiberadoMensalCentavos: number;
  saldoJaSeparadoCentavos: number;
  faltaParaQuitarCentavos: number;
  mesesEstimados: number | null;
};

// Resolve "qual é a dívida-alvo dessa meta, e qual o saldo real a
// quitar". Meta com passivo-alvo único usa o saldo documentado desse
// passivo; com vários (ou nenhum), usa o valor-alvo da própria meta.
export function resolverAlvoDaMeta(
  meta: { nome: string; valorAlvoCentavos: number },
  passivosAlvo: Pick<Passivo, "nome" | "valorQuitacaoCentavos" | "custoMensalCentavos">[]
): { nome: string; saldoCentavos: number; custoMensalCentavos: number | null } {
  const custosDocumentados = passivosAlvo.length > 0 && passivosAlvo.every((p) => p.custoMensalCentavos != null);
  return {
    nome: passivosAlvo.length === 1 ? passivosAlvo[0].nome : meta.nome,
    saldoCentavos:
      passivosAlvo.length === 1 && passivosAlvo[0].valorQuitacaoCentavos != null
        ? passivosAlvo[0].valorQuitacaoCentavos
        : meta.valorAlvoCentavos,
    custoMensalCentavos: custosDocumentados
      ? passivosAlvo.reduce((soma, p) => soma + (p.custoMensalCentavos ?? 0), 0)
      : null,
  };
}

// "Se os cortes sugeridos forem feitos, em quanto tempo a meta fecha" —
// nunca confiado ao Claude (LLM erra matemática de várias etapas).
// totalLiberadoMensalCentavos vem da soma real dos cortes;
// saldoJaSeparadoCentavos deve ser sempre o saldo ATUAL do cofre no
// momento do cálculo — o "double-check na conta do Bradesco" pedido,
// nunca um valor herdado de quando a sugestão foi gerada.
export function calcularProjecaoMeta(
  saldoAlvoCentavos: number,
  saldoJaSeparadoCentavos: number,
  cortes: CorteSugerido[]
): Projecao {
  const totalLiberadoMensalCentavos = cortes.reduce((soma, c) => soma + Math.round(c.valorLiberadoReais * 100), 0);
  const faltaParaQuitarCentavos = Math.max(0, saldoAlvoCentavos - saldoJaSeparadoCentavos);
  const mesesEstimados =
    totalLiberadoMensalCentavos > 0 ? Math.ceil(faltaParaQuitarCentavos / totalLiberadoMensalCentavos) : null;
  return { totalLiberadoMensalCentavos, saldoJaSeparadoCentavos, faltaParaQuitarCentavos, mesesEstimados };
}

// "Qual meta atacar primeiro" — nunca um critério novo, é a MESMA
// rota de ataque já usada em toda parte (alvoSugerido no cofre, Mapa,
// /otimizacao): `ordemRota` já decide, passivo a passivo, se quitar
// de uma vez ou amortizar aos poucos é o certo, recalculada do zero a
// cada carregamento — nunca uma prioridade congelada. Meta com vários
// passivos-alvo usa a posição do mais urgente entre eles. Null quando
// nenhum passivo-alvo dessa meta está na rota (sem rota calculada
// ainda, ou passivo fora da simulação por falta de saldo documentado)
// — nunca inventa uma posição pra quem não tem uma real.
export function calcularPrioridadeMeta(passivoIds: string[], ordemRota: string[] | undefined): number | null {
  if (!ordemRota || ordemRota.length === 0) return null;
  const posicoes = passivoIds.map((id) => ordemRota.indexOf(id)).filter((i) => i !== -1);
  return posicoes.length > 0 ? Math.min(...posicoes) : null;
}
