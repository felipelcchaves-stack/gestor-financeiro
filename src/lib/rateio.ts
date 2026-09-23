// Rateio automático de receita pra um "cofre" de dívida (seção livre do
// PRD, insight do Felipe): "separe X% de toda receita de uma categoria
// pra uma conta específica" — ex: 50% da receita de Religião pro
// Bradesco, transferido manualmente e marcado aqui (nunca adivinhado
// pela descrição da transação — ver TransacaoSheet.contaDestinoId).
//
// A regra vive em Configuracao (singleton) e é opcional: incompleta =
// recurso desligado (retorna null), nunca "zerado" — todo consumidor
// (Consultor, Score, resumo pra IA) precisa tratar null como "não
// configurado", não como falha.

import { prisma } from "@/lib/prisma";
import { TipoTransacao } from "@/generated/prisma";
import { calcularOfensoresPorCredor } from "@/lib/ofensores";

export type DividaQuitavel = { passivoId: string; nome: string; valorQuitacaoCentavos: number };

export type StatusRateio = {
  categoriaNome: string;
  percentual: number;
  contaDestinoId: string;
  contaDestinoNome: string;
  contaDestinoSaldoCentavos: number | null;
  contaDestinoSaldoAtualizadoEm: Date | null;
  ativoDesde: Date;
  totalRecebidoCentavos: number;
  metaSepararCentavos: number;
  totalDepositadoCentavos: number;
  faltaSepararCentavos: number;
  dividaQuitavel: DividaQuitavel | null;
};

// Janela usada só pra ranquear qual dívida quitável "mais sangra" —
// mesmo horizonte que o Felipe usou pra analisar os próprios gastos
// nesta conversa (últimos 6 meses), não o `ativoDesde` da regra (que
// pode ser bem mais recente).
const MESES_JANELA_OFENSOR = 6;

export async function calcularStatusRateio(hoje: Date = new Date()): Promise<StatusRateio | null> {
  const config = await prisma.configuracao.findUnique({ where: { id: "singleton" } });
  if (
    !config?.categoriaRateioId ||
    !config.percentualRateio ||
    !config.contaRateioDestinoId ||
    !config.rateioAtivoDesde
  ) {
    return null;
  }

  const [categoria, contaDestino, recebido, depositado, passivosElegiveis] = await Promise.all([
    prisma.categoria.findUnique({ where: { id: config.categoriaRateioId } }),
    prisma.conta.findUnique({ where: { id: config.contaRateioDestinoId } }),
    prisma.transacao.aggregate({
      where: { categoriaId: config.categoriaRateioId, tipo: TipoTransacao.ENTRADA, data: { gte: config.rateioAtivoDesde } },
      _sum: { valorCentavos: true },
    }),
    prisma.transacao.aggregate({
      where: { contaDestinoId: config.contaRateioDestinoId, ehTransferencia: true, data: { gte: config.rateioAtivoDesde } },
      _sum: { valorCentavos: true },
    }),
    prisma.passivo.findMany({
      where: { status: "ATIVO", valorQuitacaoCentavos: { not: null } },
      select: { id: true, nome: true, valorQuitacaoCentavos: true },
    }),
  ]);

  if (!categoria || !contaDestino) return null;

  const totalRecebidoCentavos = recebido._sum.valorCentavos ?? 0;
  const totalDepositadoCentavos = depositado._sum.valorCentavos ?? 0;
  const metaSepararCentavos = Math.round((totalRecebidoCentavos * config.percentualRateio) / 100);
  const faltaSepararCentavos = Math.max(0, metaSepararCentavos - totalDepositadoCentavos);

  const saldoCentavos = contaDestino.saldoAtualCentavos ?? 0;
  const candidatos = passivosElegiveis.filter((p) => (p.valorQuitacaoCentavos ?? Infinity) <= saldoCentavos);

  let dividaQuitavel: DividaQuitavel | null = null;
  if (candidatos.length > 0) {
    const desdeJanela = new Date(hoje.getFullYear(), hoje.getMonth() - (MESES_JANELA_OFENSOR - 1), 1);
    const ranking = await calcularOfensoresPorCredor(desdeJanela);
    const candidatosIds = new Set(candidatos.map((c) => c.id));
    const maiorOfensor = ranking.find((r) => candidatosIds.has(r.id));
    const passivoEscolhido = candidatos.find((c) => c.id === maiorOfensor?.id) ?? candidatos[0];
    dividaQuitavel = {
      passivoId: passivoEscolhido.id,
      nome: passivoEscolhido.nome,
      valorQuitacaoCentavos: passivoEscolhido.valorQuitacaoCentavos!,
    };
  }

  return {
    categoriaNome: categoria.nome,
    percentual: config.percentualRateio,
    contaDestinoId: contaDestino.id,
    contaDestinoNome: contaDestino.nome,
    contaDestinoSaldoCentavos: contaDestino.saldoAtualCentavos,
    contaDestinoSaldoAtualizadoEm: contaDestino.saldoAtualizadoEm,
    ativoDesde: config.rateioAtivoDesde,
    totalRecebidoCentavos,
    metaSepararCentavos,
    totalDepositadoCentavos,
    faltaSepararCentavos,
    dividaQuitavel,
  };
}
