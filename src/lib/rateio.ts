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
import type { EstadoAtual } from "@/lib/estadoAtual";

export type DividaQuitavel = { passivoId: string; nome: string; valorQuitacaoCentavos: number };

// Mesmo alvo de DividaQuitavel, mas sem exigir que o saldo já cubra o
// valor inteiro — "pra qual dívida vale mais a pena direcionar esse
// dinheiro", mesmo que ainda falte separar mais. mesQuitacaoProjetado
// vem da própria rota já simulada (nunca inventado).
export type AlvoSugerido = {
  passivoId: string;
  nome: string;
  valorQuitacaoCentavos: number;
  custoMensalCentavos: number;
  faltaParaQuitarCentavos: number;
  mesQuitacaoProjetado: number | null;
};

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
  alvoSugerido: AlvoSugerido | null;
};

// Ordem de ataque pra decidir tanto dividaQuitavel quanto
// alvoSugerido: preferência é a ordem de menor juro total já simulada
// (estado.rota — o mesmo motor usado no Mapa/Otimização), que já
// considera taxa e estrutura de cada passivo. Sem rota calculada
// (falta aporte mensal extra configurado em /consultor), cai num
// critério simples — maior custo mensal — em vez de não sugerir nada.
function ordemDeAtaque(estado: EstadoAtual): string[] {
  if (estado.rota) return estado.rota.resultado.ordemIds;
  return [...estado.elegiveis].sort((a, b) => b.custoMensalCentavos - a.custoMensalCentavos).map((p) => p.id);
}

export async function calcularStatusRateio(estado: EstadoAtual): Promise<StatusRateio | null> {
  const config = await prisma.configuracao.findUnique({ where: { id: "singleton" } });
  if (
    !config?.categoriaRateioId ||
    !config.percentualRateio ||
    !config.contaRateioDestinoId ||
    !config.rateioAtivoDesde
  ) {
    return null;
  }

  const [categoria, contaDestino, recebido, depositado] = await Promise.all([
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
  ]);

  if (!categoria || !contaDestino) return null;

  const totalRecebidoCentavos = recebido._sum.valorCentavos ?? 0;
  const saldoCentavos = contaDestino.saldoAtualCentavos ?? 0;
  // "Separado" nunca fica abaixo do saldo real da conta — marcar cada
  // transferência manualmente (aba Transações) é o caminho fino, mas
  // exige lembrar de fazer isso toda vez; o saldo atualizado pelo
  // botão em /contas é uma prova mais direta de que o dinheiro já
  // chegou lá, mesmo sem a transação específica marcada ainda. Usa o
  // maior dos dois pra nunca subestimar o que já foi separado de
  // verdade.
  const totalDepositadoViaTransacoes = depositado._sum.valorCentavos ?? 0;
  const totalDepositadoCentavos = Math.max(totalDepositadoViaTransacoes, saldoCentavos);
  const metaSepararCentavos = Math.round((totalRecebidoCentavos * config.percentualRateio) / 100);
  const faltaSepararCentavos = Math.max(0, metaSepararCentavos - totalDepositadoCentavos);
  const ordem = ordemDeAtaque(estado);
  const porId = new Map(estado.elegiveis.map((p) => [p.id, p]));

  let dividaQuitavel: DividaQuitavel | null = null;
  const idQuitavel = ordem.find((id) => (porId.get(id)?.saldoCentavos ?? Infinity) <= saldoCentavos);
  if (idQuitavel) {
    const p = porId.get(idQuitavel)!;
    dividaQuitavel = { passivoId: p.id, nome: p.nome, valorQuitacaoCentavos: p.saldoCentavos };
  }

  let alvoSugerido: AlvoSugerido | null = null;
  const idAlvo = ordem[0];
  if (idAlvo) {
    const p = porId.get(idAlvo)!;
    const quitacao = estado.rota?.resultado.quitacoes.find((q) => q.passivoId === idAlvo);
    alvoSugerido = {
      passivoId: p.id,
      nome: p.nome,
      valorQuitacaoCentavos: p.saldoCentavos,
      custoMensalCentavos: p.custoMensalCentavos,
      faltaParaQuitarCentavos: Math.max(0, p.saldoCentavos - saldoCentavos),
      mesQuitacaoProjetado: quitacao?.mes ?? null,
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
    alvoSugerido,
  };
}
