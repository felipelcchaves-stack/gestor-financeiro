// Agrega, num lugar só, tudo que já é "informação relevante pra tomar
// decisão" espalhado pelo app — sem duplicar nenhuma lógica de alerta.
// Roda em toda navegação (chamado a partir de src/app/layout.tsx), por
// isso busca só o necessário com queries leves, e de propósito NÃO usa
// carregarEstadoAtual() (que roda a simulação de otimização inteira —
// cara demais só pra montar uma lista de avisos).

import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import { calcularAlertas, DIAS_PASSIVO_RECENTE } from "@/lib/alertas";
import { calcularProximasAcoes } from "@/lib/proximaAcao";
import { parcelasPendentesPorData, proximaParcela } from "@/lib/cronogramaAmortizacao";
import { calcularPrioridadeMeta } from "@/lib/projecaoMeta";
import { carregarRotaLeve } from "@/lib/rotaLeve";
import { StatusMeta } from "@/generated/prisma";

export type Notificacao = {
  titulo: string;
  mensagem: string;
  href: string | null;
  severidade: "alerta" | "tarefa";
};

// Parcela vencendo dentro dessa janela vira notificação "tarefa" — mais
// que isso ainda não é urgente o bastante pra aparecer no sino.
const JANELA_DIAS_VENCIMENTO = 7;

function diasEntre(a: Date, b: Date): number {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export async function carregarNotificacoes(hoje: Date = new Date()): Promise<Notificacao[]> {
  const desdeRecente = new Date(hoje.getTime() - DIAS_PASSIVO_RECENTE * 24 * 60 * 60 * 1000);

  const [passivosAtivos, contas, metasAtivas, configuracao, snapshots, passivosComCiclos, passivosRecentesSemMeta, passivosComCronograma, rota] =
    await Promise.all([
      prisma.passivo.findMany({ where: { status: "ATIVO" } }),
      prisma.conta.findMany({
        select: { nome: true, saldoAtualCentavos: true, limiteChequeEspecialCentavos: true, carenciaDiasChequeEspecial: true, saldoAtualizadoEm: true },
      }),
      prisma.meta.findMany({
        where: { status: StatusMeta.ATIVA },
        include: {
          alocacoes: true,
          passivosAlvo: { include: { passivo: { include: { _count: { select: { transacoes: true } } } } } },
        },
      }),
      prisma.configuracao.findUnique({ where: { id: "singleton" } }),
      prisma.patrimonioSnapshot.findMany({ select: { mesReferencia: true } }),
      prisma.passivo.findMany({
        where: { custoMensalVariavel: true },
        select: { id: true, nome: true, ciclosFatura: { select: { referencia: true, valorCentavos: true } } },
      }),
      prisma.passivo.findMany({
        where: { status: "ATIVO", createdAt: { gte: desdeRecente }, metas: { none: {} } },
        select: { nome: true, createdAt: true },
      }),
      prisma.passivo.findMany({
        where: { status: "ATIVO", cronograma: { some: {} } },
        select: { id: true, nome: true, parcelaAtual: true, cronograma: true },
      }),
      carregarRotaLeve(),
    ]);

  const alertas = calcularAlertas({ contas, passivosComCiclos, passivosRecentesSemMeta, hoje });
  const acoes = calcularProximasAcoes({
    passivos: passivosAtivos,
    metas: metasAtivas,
    contas,
    configuracao,
    snapshots,
    hoje,
  }).filter((a) => a.tipo === "tarefa");

  // "1ª/2ª prioridade" e "% pago" pras metas de dívida — mesma rota de
  // menor juro já usada em /cofre (carregarRotaLeve, versão sem o
  // resto de carregarEstadoAtual), e a mesma matemática de "% pago =
  // 1 − saldo atual ÷ saldo documentado quando a meta foi criada" sem
  // depender de AlocacaoMeta (que nunca é populado pra dívida).
  const ordemRota = rota?.resultado.ordemIds;
  const notificacoesPrioridade: Notificacao[] = metasAtivas
    .map((meta) => {
      const passivosAlvo = meta.passivosAlvo.map((mp) => mp.passivo);
      if (passivosAlvo.length === 0) return null;
      const prioridade = calcularPrioridadeMeta(passivosAlvo.map((p) => p.id), ordemRota);
      if (prioridade == null) return null;

      const saldoAtualCentavos = passivosAlvo.reduce((soma, p) => soma + (p.valorQuitacaoCentavos ?? 0), 0);
      const pctPago = meta.valorAlvoCentavos > 0 ? Math.max(0, 1 - saldoAtualCentavos / meta.valorAlvoCentavos) : 0;

      return { meta, prioridade, pctPago, saldoAtualCentavos };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => a.prioridade - b.prioridade)
    .slice(0, 2)
    .map(({ meta, prioridade, pctPago, saldoAtualCentavos }, i): Notificacao => ({
      titulo: `${i + 1}ª prioridade — ${meta.nome}: ${Math.round(pctPago * 100)}% pago`,
      mensagem: `Faltam ${formatarBRL(saldoAtualCentavos)} pra quitar. Posição ${prioridade + 1} na rota de menor juro.`,
      href: "/cofre",
      severidade: "tarefa",
    }));

  const notificacoesVencimento: Notificacao[] = [];
  for (const p of passivosComCronograma) {
    const parcelaAtual = p.parcelaAtual ?? 0;
    const vencidasNaoConfirmadas = parcelasPendentesPorData(p.cronograma, parcelaAtual, hoje);
    if (vencidasNaoConfirmadas.length > 0) {
      const primeira = vencidasNaoConfirmadas[0];
      notificacoesVencimento.push({
        titulo: `Parcela de ${p.nome} venceu e ainda não foi confirmada`,
        mensagem: `Parcela ${primeira.numeroParcela} (${formatarBRL(primeira.valorParcelaCentavos)}) venceu em ${primeira.vencimento.toLocaleDateString("pt-BR")} — confirme o pagamento vinculando a transação real, ou reveja o saldo se algo mudou.`,
        href: `/passivos/${p.id}`,
        severidade: "alerta",
      });
      continue;
    }

    const proxima = proximaParcela(p.cronograma, parcelaAtual);
    if (proxima) {
      const dias = diasEntre(proxima.vencimento, hoje);
      if (dias >= 0 && dias <= JANELA_DIAS_VENCIMENTO) {
        notificacoesVencimento.push({
          titulo: `Parcela de ${p.nome} vence em ${dias} dia${dias === 1 ? "" : "s"}`,
          mensagem: `Parcela ${proxima.numeroParcela} (${formatarBRL(proxima.valorParcelaCentavos)}), vencimento em ${proxima.vencimento.toLocaleDateString("pt-BR")}.`,
          href: `/passivos/${p.id}`,
          severidade: "tarefa",
        });
      }
    }
  }

  return [
    ...alertas.map((a): Notificacao => ({
      titulo: a.titulo,
      mensagem: a.mensagem,
      href: a.passivoId ? `/passivos/${a.passivoId}` : null,
      severidade: "alerta",
    })),
    ...notificacoesVencimento,
    ...notificacoesPrioridade,
    ...acoes.map((a): Notificacao => ({ titulo: a.titulo, mensagem: a.descricao, href: a.href, severidade: "tarefa" })),
  ];
}
