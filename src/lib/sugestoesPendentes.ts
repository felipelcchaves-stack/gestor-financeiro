// Contador leve pro selo no menu (src/components/AppSidebar.tsx,
// chamado a partir de src/app/layout.tsx — roda em TODA navegação do
// app). De propósito NÃO usa carregarEstadoAtual() nem a rota de
// otimização: essas rodam a simulação inteira (permutação exaustiva
// entre passivos), cara demais pra rodar em toda página só pra mostrar
// um número. Aqui é só "quantos passivos sem meta o saldo do cofre já
// cobre" — mesmo critério `jaQuitavel` de src/lib/alvosOportunistas.ts,
// sem ordenação nem aceleração (isso o /cofre já calcula de verdade).
//
// Existe pra resolver um pedido específico do Felipe: como o motor que
// decide "o que sugerir" já é recalculado do zero a cada carregamento
// de /cofre, a única coisa que faltava era ele não precisar LEMBRAR de
// visitar a página depois de importar um extrato pra descobrir que uma
// meta nova ficou possível — esse selo fica visível em qualquer lugar
// do app, sempre atual.

import { prisma } from "@/lib/prisma";

export async function contarSugestoesPendentes(): Promise<number> {
  const config = await prisma.configuracao.findUnique({ where: { id: "singleton" } });
  if (!config?.contaRateioDestinoId) return 0;

  const [conta, passivosElegiveis, metas] = await Promise.all([
    prisma.conta.findUnique({ where: { id: config.contaRateioDestinoId }, select: { saldoAtualCentavos: true } }),
    prisma.passivo.findMany({
      where: { status: "ATIVO", valorQuitacaoCentavos: { not: null } },
      select: { id: true, valorQuitacaoCentavos: true },
    }),
    prisma.meta.findMany({
      where: { contaOrigemId: config.contaRateioDestinoId },
      select: { passivosAlvo: { select: { passivoId: true } } },
    }),
  ]);

  const saldoCofreCentavos = conta?.saldoAtualCentavos ?? 0;
  const passivoIdsComMeta = new Set(metas.flatMap((m) => m.passivosAlvo.map((mp) => mp.passivoId)));

  return passivosElegiveis.filter(
    (p) => !passivoIdsComMeta.has(p.id) && p.valorQuitacaoCentavos! <= saldoCofreCentavos
  ).length;
}
