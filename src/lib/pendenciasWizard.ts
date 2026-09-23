// Lista granular de dado estrutural faltando — um passo por item, pra
// alimentar o wizard que abre sozinho (src/components/PendenciasWizard.tsx,
// chamado a partir do layout raiz). Mesmo critério já usado em
// src/lib/proximaAcao.ts (o topo da hierarquia: "dado estrutural
// faltando"), só que aqui não agrupa nem limita a 3 — cada pendência
// vira o próprio passo. Queries leves e paralelas, sem
// carregarEstadoAtual() (mesmo princípio de custo de
// src/lib/sugestoesPendentes.ts, roda em toda navegação).

import { prisma } from "@/lib/prisma";

export type PendenciaWizard =
  | { tipo: "passivoSemSaldo"; passivoId: string; nome: string }
  | { tipo: "contaSemSaldo"; contaId: string; nome: string }
  | { tipo: "aporteNaoConfigurado" };

export async function calcularPendenciasWizard(): Promise<PendenciaWizard[]> {
  const [passivosSemSaldo, contasSemSaldo, configuracao] = await Promise.all([
    prisma.passivo.findMany({
      where: { status: "ATIVO", valorQuitacaoCentavos: null },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.conta.findMany({
      where: { saldoAtualizadoEm: null },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.configuracao.findUnique({ where: { id: "singleton" } }),
  ]);

  const pendencias: PendenciaWizard[] = [
    ...passivosSemSaldo.map((p): PendenciaWizard => ({ tipo: "passivoSemSaldo", passivoId: p.id, nome: p.nome })),
    ...contasSemSaldo.map((c): PendenciaWizard => ({ tipo: "contaSemSaldo", contaId: c.id, nome: c.nome })),
  ];

  if (configuracao?.aporteMensalExtraCentavos == null) {
    pendencias.push({ tipo: "aporteNaoConfigurado" });
  }

  return pendencias;
}
