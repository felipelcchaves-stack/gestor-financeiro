// Lógica compartilhada de "confirmar um lançamento importado" — usada tanto
// pela importação de extrato quanto pela de fatura de cartão, pra não
// duplicar (e deixar divergir) o tratamento de duplicata, aprendizado de
// classificação e marcação de despesa essencial recorrente.

import { prisma } from "@/lib/prisma";
import { normalizarDescricao, aprenderRegraClassificacao } from "@/lib/classificacao";
import {
  TipoTransacao,
  OrigemTransacao,
  FrequenciaRecorrencia,
  Confiabilidade,
  Prisma,
} from "@/generated/prisma";

export type LancamentoClassificado = {
  data: Date;
  descricao: string;
  valorCentavos: number;
  tipo: TipoTransacao;
  origem: OrigemTransacao;
  hashDedupe: string;
  documentoId: string;
  categoriaId: string | null;
  contaId?: string | null;
  passivoId?: string | null;
  ativoId?: string | null;
  metaId?: string | null;
  saldoAposCentavos?: number | null;
  essencial?: boolean;
  parcelaAtual?: number | null;
  totalParcelas?: number | null;
  ehTransferencia?: boolean;
  contaDestinoId?: string | null;
};

export type ResultadoConfirmarLancamento =
  | { criado: true; transacaoId: string }
  | { criado: false; duplicata: true };

// Soma `deltaCentavos` (pode ser negativo, pra reverter) ao saldo de uma
// conta — trata saldo nunca documentado (null) como zero antes de somar.
// Sempre atualiza `saldoAtualizadoEm`: se um dia o extrato real dessa
// conta for importado, a detecção de "saldo do dia" sobrescreve esse
// valor calculado com o oficial do banco — isso aqui é só a melhor
// estimativa até lá.
export async function ajustarSaldoConta(contaId: string, deltaCentavos: number): Promise<void> {
  if (deltaCentavos === 0) return;
  const conta = await prisma.conta.findUnique({ where: { id: contaId }, select: { saldoAtualCentavos: true } });
  if (!conta) return;
  await prisma.conta.update({
    where: { id: contaId },
    data: { saldoAtualCentavos: (conta.saldoAtualCentavos ?? 0) + deltaCentavos, saldoAtualizadoEm: new Date() },
  });
}

// Cria a transação (com toda a aprendizagem — regra de classificação,
// alocação de meta, recorrência essencial). Se a "impressão digital" de
// dedupe (hashDedupe, @unique no banco) já existir, trata como duplicata em
// vez de travar a importação inteira (colisão dentro do mesmo lote, ou
// reimportação do mesmo documento).
export async function confirmarLancamentoClassificado(
  l: LancamentoClassificado
): Promise<ResultadoConfirmarLancamento> {
  let transacao;
  try {
    transacao = await prisma.transacao.create({
      data: {
        data: l.data,
        descricao: l.descricao,
        valorCentavos: l.valorCentavos,
        saldoAposCentavos: l.saldoAposCentavos ?? null,
        tipo: l.tipo,
        origem: l.origem,
        contaId: l.contaId ?? null,
        categoriaId: l.categoriaId,
        documentoId: l.documentoId,
        hashDedupe: l.hashDedupe,
        passivoId: l.passivoId ?? null,
        ativoId: l.ativoId ?? null,
        parcelaAtual: l.parcelaAtual ?? null,
        totalParcelas: l.totalParcelas ?? null,
        ehTransferencia: l.ehTransferencia ?? false,
        contaDestinoId: l.contaDestinoId ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { criado: false, duplicata: true };
    }
    throw err;
  }

  if (l.ehTransferencia && l.contaDestinoId) {
    await ajustarSaldoConta(l.contaDestinoId, l.valorCentavos);
  }

  if (l.metaId) {
    await prisma.alocacaoMeta.create({
      data: {
        metaId: l.metaId,
        transacaoId: transacao.id,
        valorCentavos: l.valorCentavos,
        data: l.data,
      },
    });
  }

  // Sem categoria não há o que memorizar — RegraClassificacao.categoriaId é obrigatório no schema.
  if (l.categoriaId) {
    await aprenderRegraClassificacao({
      descricao: l.descricao,
      tipo: l.tipo,
      categoriaId: l.categoriaId,
      passivoId: l.passivoId,
      ativoId: l.ativoId,
      metaId: l.metaId,
    });
  }

  // Marca como despesa essencial recorrente — cria ou atualiza a Recorrência
  // correspondente (mesma chave normalizada usada acima pra RegraClassificacao),
  // pra alimentar a tela de limite de cartão.
  if (l.essencial) {
    const nomeRecorrencia = normalizarDescricao(l.descricao);
    const recorrenciaExistente = await prisma.recorrenciaFinanceira.findFirst({
      where: { nome: nomeRecorrencia },
    });

    if (recorrenciaExistente) {
      await prisma.recorrenciaFinanceira.update({
        where: { id: recorrenciaExistente.id },
        data: {
          valorCentavos: l.valorCentavos,
          essencial: true,
          passivoId: l.passivoId ?? recorrenciaExistente.passivoId,
          categoriaId: l.categoriaId ?? recorrenciaExistente.categoriaId,
        },
      });
    } else {
      await prisma.recorrenciaFinanceira.create({
        data: {
          nome: nomeRecorrencia,
          tipo: l.tipo,
          valorCentavos: l.valorCentavos,
          frequencia: FrequenciaRecorrencia.MENSAL,
          confiabilidade: Confiabilidade.CONFIRMADO,
          essencial: true,
          passivoId: l.passivoId ?? null,
          categoriaId: l.categoriaId,
        },
      });
    }
  }

  return { criado: true, transacaoId: transacao.id };
}
