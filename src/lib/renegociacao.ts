// Oportunidades de renegociação/portabilidade: compara a taxa documentada de
// cada passivo com uma faixa típica de mercado (referência geral aproximada,
// não é dado oficial nem específico do seu contrato) — quando a taxa real
// está acima do teto da faixa, pode valer tentar renegociar ou portar pra
// outra instituição.

import type { Passivo } from "@/generated/prisma";

export const FAIXA_MERCADO_MENSAL: Record<string, { min: number; max: number; label: string }> = {
  cartao: { min: 10, max: 16, label: "cartão de crédito (rotativo)" },
  "capital-de-giro": { min: 2, max: 5, label: "capital de giro PJ" },
  consignado: { min: 1.5, max: 2.5, label: "consignado" },
  "emprestimo-pessoal": { min: 4, max: 9, label: "empréstimo pessoal" },
  financiamento: { min: 1, max: 1.8, label: "financiamento" },
};

export type OportunidadeRenegociacao = {
  passivoId: string;
  nome: string;
  taxaJurosPct: number;
  faixaLabel: string;
  faixaMaxPct: number;
  mensagem: string;
};

export function calcularOportunidadesRenegociacao(
  passivosAtivos: Pick<Passivo, "id" | "nome" | "tipo" | "taxaJurosPct">[]
): OportunidadeRenegociacao[] {
  const oportunidades: OportunidadeRenegociacao[] = [];

  for (const p of passivosAtivos) {
    if (p.taxaJurosPct == null) continue;
    const faixa = FAIXA_MERCADO_MENSAL[p.tipo];
    if (!faixa) continue;

    if (p.taxaJurosPct > faixa.max) {
      oportunidades.push({
        passivoId: p.id,
        nome: p.nome,
        taxaJurosPct: p.taxaJurosPct,
        faixaLabel: faixa.label,
        faixaMaxPct: faixa.max,
        mensagem: `Sua taxa (${p.taxaJurosPct}% a.m.) está acima da faixa típica de mercado pra ${faixa.label} (${faixa.min}%–${faixa.max}% a.m.) — pode valer tentar renegociar ou portar pra outra instituição.`,
      });
    }
  }

  return oportunidades.sort((a, b) => b.taxaJurosPct - a.taxaJurosPct);
}
