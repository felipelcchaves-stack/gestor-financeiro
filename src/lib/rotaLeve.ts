// Versão enxuta de src/lib/estadoAtual.ts::carregarEstadoAtual — só a
// parte que decide a rota de ataque (escolherEstrategia), sem ativos,
// patrimônio, sinal, margem livre, alertas nem próximas ações (tudo
// isso é irrelevante pra quem só precisa saber "qual a posição de cada
// passivo na rota"). Existe pra não pagar o custo da simulação de
// otimização inteira em lugares que rodam em TODA navegação (ex:
// src/lib/notificacoes.ts, chamado a partir do layout raiz) — mesmo
// princípio já usado em src/lib/sugestoesPendentes.ts.

import { prisma } from "@/lib/prisma";
import { escolherEstrategia, type EstrategiaId, type PassivoParaOtimizacao } from "@/lib/otimizacao";

export async function carregarRotaLeve(): Promise<ReturnType<typeof escolherEstrategia> | null> {
  const [passivosAtivos, configuracao] = await Promise.all([
    prisma.passivo.findMany({ where: { status: "ATIVO" } }),
    prisma.configuracao.findUnique({ where: { id: "singleton" } }),
  ]);

  const elegiveis: PassivoParaOtimizacao[] = passivosAtivos
    .filter((p) => p.valorQuitacaoCentavos != null)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      saldoCentavos: p.valorQuitacaoCentavos!,
      custoMensalCentavos: p.custoMensalCentavos ?? 0,
      estrutura: p.estrutura,
    }));

  const aporte = configuracao?.aporteMensalExtraCentavos ?? null;
  if (aporte == null || elegiveis.length === 0) return null;

  return escolherEstrategia(elegiveis, aporte, configuracao?.estrategiaEscolhida as EstrategiaId | null, configuracao?.splitHibridoPct);
}
