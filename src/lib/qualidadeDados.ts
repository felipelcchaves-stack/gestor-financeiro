// Torna visível, de forma acionável, a desconexão entre o histórico
// importado e o que Otimização/Consultor/Mapa realmente enxergam — sem
// isso o buraco só existe no banco, invisível pra quem usa o app.

import { prisma } from "@/lib/prisma";
import { calcularReconciliacaoPassivo } from "@/lib/passivoReconciliacao";

export type PassivoDesatualizado = { id: string; nome: string; diasSemAtualizacao: number; nuncaAtualizado: boolean };

// Diferente de PassivoDesatualizado (baseado em tempo — "faz X dias que
// ninguém confirma"), este é baseado em fato real: existe uma transação
// vinculada que já muda o saldo, e a confirmação nunca foi feita. Pega
// exatamente o caso "eu paguei isso e o extrato já mostra, mas o app
// ainda usa o número antigo" — que o alerta de tempo pode não pegar se a
// última confirmação foi recente.
export type PassivoReconciliacaoPendente = {
  id: string;
  nome: string;
  saldoDocumentadoCentavos: number | null;
  saldoSugeridoCentavos: number;
};

export type AtivoFinanciadoAlerta = {
  ativoId: string;
  ativoNome: string;
  passivoId: string;
  passivoNome: string;
  motivo: "passivo_quitado" | "passivo_desatualizado";
};

export type PassivoSemMovimento = { id: string; nome: string; custoMensalCentavos: number | null };

export type QualidadeDados = {
  totalTransacoes: number;
  semCategoria: number;
  semVinculo: number;
  passivosDesatualizados: PassivoDesatualizado[];
  ativosFinanciadosDesatualizados: AtivoFinanciadoAlerta[];
  passivosSemMovimentoRecente: PassivoSemMovimento[];
  passivosComReconciliacaoPendente: PassivoReconciliacaoPendente[];
};

// Um passivo cujo saldo nunca foi confirmado desde o cadastro entra na
// lista sempre, não importa há quantos dias — "nunca" é o sinal
// importante ali, e um cadastro recente não devia mascarar isso. Pra quem
// já teve alguma confirmação, só reaparece depois de 60 dias sem outra —
// generoso o bastante pra não soar alarmista com uma rotina mensal normal.
const LIMIAR_DIAS_DESATUALIZADO = 60;

// Mesma janela usada no "Comparativo mensal" de /ofensores — um passivo sem
// nenhuma transação vinculada nesse período nunca aparece lá, nem em
// Categoria nem em Credor. Geralmente não é "parei de pagar": é pagamento
// real que foi importado mas nunca vinculado ao passivo certo (caindo no
// balde "sem vínculo" em vez de no credor de verdade).
const MESES_SEM_MOVIMENTO = 12;

function diasSemAtualizacaoDe(referencia: Date): number {
  return Math.floor((Date.now() - referencia.getTime()) / (1000 * 60 * 60 * 24));
}

export async function calcularQualidadeDados(): Promise<QualidadeDados> {
  const hoje = new Date();
  const desdeMovimento = new Date(hoje.getFullYear(), hoje.getMonth() - (MESES_SEM_MOVIMENTO - 1), 1);

  const [totalTransacoes, semCategoria, semVinculo, passivosAtivos, vinculosFinanciamento, transacoesComPassivoRecentes] =
    await Promise.all([
      prisma.transacao.count(),
      prisma.transacao.count({ where: { categoriaId: null } }),
      prisma.transacao.count({ where: { passivoId: null, ativoId: null, alocacaoMeta: null } }),
      prisma.passivo.findMany({
        where: { status: "ATIVO" },
        select: {
          id: true,
          nome: true,
          custoMensalCentavos: true,
          createdAt: true,
          historico: {
            where: { campo: "valorQuitacaoCentavos" },
            orderBy: { registradoEm: "desc" },
            take: 1,
            select: { registradoEm: true },
          },
        },
      }),
    // Ativo "financiado" por uma dívida (o saldo veio do dinheiro dela) só
    // continua fazendo sentido enquanto a dívida existir e estiver com
    // saldo confirmado — senão o patrimônio líquido corre o risco de estar
    // contando esse ativo como novo sem mais desconto nenhum do lado da
    // dívida (ver src/app/ativos/[id]/page.tsx e prisma/schema.prisma,
    // TipoVinculoAtivoPassivo).
    prisma.ativoPassivoVinculo.findMany({
      where: { tipoVinculo: "FINANCIAMENTO" },
      select: {
        ativoId: true,
        ativo: { select: { nome: true } },
        passivoId: true,
        passivo: {
          select: {
            nome: true,
            status: true,
            createdAt: true,
            historico: {
              where: { campo: "valorQuitacaoCentavos" },
              orderBy: { registradoEm: "desc" },
              take: 1,
              select: { registradoEm: true },
            },
          },
        },
      },
    }),
    prisma.transacao.findMany({
      where: { tipo: "DESPESA", ehTransferencia: false, passivoId: { not: null }, data: { gte: desdeMovimento } },
      select: { passivoId: true },
      distinct: ["passivoId"],
    }),
  ]);

  const passivosDesatualizados = passivosAtivos
    .map((p) => {
      const ultimaAtualizacao = p.historico[0]?.registradoEm ?? null;
      const diasSemAtualizacao = diasSemAtualizacaoDe(ultimaAtualizacao ?? p.createdAt);
      return { id: p.id, nome: p.nome, diasSemAtualizacao, nuncaAtualizado: ultimaAtualizacao == null };
    })
    .filter((p) => p.nuncaAtualizado || p.diasSemAtualizacao >= LIMIAR_DIAS_DESATUALIZADO)
    .sort((a, b) => Number(b.nuncaAtualizado) - Number(a.nuncaAtualizado) || b.diasSemAtualizacao - a.diasSemAtualizacao);

  const ativosFinanciadosDesatualizados: AtivoFinanciadoAlerta[] = vinculosFinanciamento
    .map((v) => {
      if (v.passivo.status !== "ATIVO") {
        return { ativoId: v.ativoId, ativoNome: v.ativo.nome, passivoId: v.passivoId, passivoNome: v.passivo.nome, motivo: "passivo_quitado" as const };
      }
      const ultimaAtualizacao = v.passivo.historico[0]?.registradoEm ?? null;
      const diasSemAtualizacao = diasSemAtualizacaoDe(ultimaAtualizacao ?? v.passivo.createdAt);
      if (ultimaAtualizacao == null || diasSemAtualizacao >= LIMIAR_DIAS_DESATUALIZADO) {
        return { ativoId: v.ativoId, ativoNome: v.ativo.nome, passivoId: v.passivoId, passivoNome: v.passivo.nome, motivo: "passivo_desatualizado" as const };
      }
      return null;
    })
    .filter((a): a is AtivoFinanciadoAlerta => a != null);

  const idsComMovimento = new Set(transacoesComPassivoRecentes.map((t) => t.passivoId));
  const passivosSemMovimentoRecente: PassivoSemMovimento[] = passivosAtivos
    .filter((p) => !idsComMovimento.has(p.id))
    .map((p) => ({ id: p.id, nome: p.nome, custoMensalCentavos: p.custoMensalCentavos ?? null }));

  const reconciliacoes = await Promise.all(
    passivosAtivos.map(async (p) => ({ p, reconciliacao: await calcularReconciliacaoPassivo(p.id) }))
  );
  const passivosComReconciliacaoPendente: PassivoReconciliacaoPendente[] = reconciliacoes
    .filter(({ reconciliacao }) => reconciliacao?.saldoSugeridoCentavos != null)
    .map(({ p, reconciliacao }) => ({
      id: p.id,
      nome: p.nome,
      saldoDocumentadoCentavos: reconciliacao!.saldoAtualDocumentadoCentavos,
      saldoSugeridoCentavos: reconciliacao!.saldoSugeridoCentavos!,
    }));

  return {
    totalTransacoes,
    semCategoria,
    semVinculo,
    passivosDesatualizados,
    ativosFinanciadosDesatualizados,
    passivosSemMovimentoRecente,
    passivosComReconciliacaoPendente,
  };
}
