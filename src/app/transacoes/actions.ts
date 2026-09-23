"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, TipoTransacao } from "@/generated/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";
import { aprenderRegraClassificacao, normalizarDescricao } from "@/lib/classificacao";
import { encontrarGruposSugeridos, type GrupoSugerido } from "@/lib/agrupamentoTransacoes";
import { inicioDoPeriodo, type Periodo } from "@/lib/ofensores";

export async function atualizarTransacao(id: string, formData: FormData) {
  const descricao = textoDoForm(formData, "descricao");
  const dataRaw = textoDoForm(formData, "data");
  const valorCentavos = centavosDoForm(formData, "valor");
  const tipo = formData.get("tipo") as TipoTransacao;
  const categoriaId = textoDoForm(formData, "categoriaId");
  const ehTransferencia = formData.get("ehTransferencia") === "on";
  const contaDestinoId = ehTransferencia ? textoDoForm(formData, "contaDestinoId") : null;

  if (!descricao || !dataRaw || valorCentavos == null || !tipo) {
    throw new Error("Preencha descrição, data, valor e tipo.");
  }

  const transacaoAnterior = await prisma.transacao.findUnique({
    where: { id },
    select: { passivoId: true, ativoId: true, alocacaoMeta: { select: { metaId: true } } },
  });

  await prisma.transacao.update({
    where: { id },
    data: { descricao, data: new Date(dataRaw), valorCentavos, tipo, categoriaId, ehTransferencia, contaDestinoId },
  });

  // Reclassificar manualmente também ensina o sistema — a próxima
  // importação de extrato/fatura já chega sugerindo essa categoria pra
  // descrições parecidas com essa.
  if (categoriaId) {
    await aprenderRegraClassificacao({
      descricao,
      tipo,
      categoriaId,
      passivoId: transacaoAnterior?.passivoId,
      ativoId: transacaoAnterior?.ativoId,
      metaId: transacaoAnterior?.alocacaoMeta?.metaId,
    });
  }

  revalidatePath("/transacoes");
}

export async function excluirTransacao(id: string) {
  await prisma.$transaction([
    prisma.alocacaoMeta.deleteMany({ where: { transacaoId: id } }),
    prisma.transacao.delete({ where: { id } }),
  ]);

  revalidatePath("/transacoes");
}

export type VinculoTipoLote = "PASSIVO" | "ATIVO" | "META";

// Vincular em lote — o retroativo dos 1.420 lançamentos já importados sem
// nenhum vínculo a passivo/ativo/meta: acha um grupo com o filtro de
// "credor parecido" já existente em /transacoes e vincula tudo de uma vez,
// em vez de um por um. Sem isso, o saldo dos passivos nunca reflete os
// pagamentos reais do extrato (ver calcularReconciliacaoPassivo).
export async function atualizarVinculoEmLote(ids: string[], vinculoTipo: VinculoTipoLote, vinculoId: string) {
  if (ids.length === 0 || !vinculoId) return;

  if (vinculoTipo === "PASSIVO") {
    await prisma.transacao.updateMany({
      where: { id: { in: ids } },
      data: { passivoId: vinculoId, ativoId: null },
    });
  } else if (vinculoTipo === "ATIVO") {
    await prisma.transacao.updateMany({
      where: { id: { in: ids } },
      data: { ativoId: vinculoId, passivoId: null },
    });
  } else {
    const transacoes = await prisma.transacao.findMany({
      where: { id: { in: ids } },
      select: { id: true, valorCentavos: true, data: true },
    });
    await prisma.transacao.updateMany({ where: { id: { in: ids } }, data: { passivoId: null, ativoId: null } });
    await prisma.$transaction(
      transacoes.map((t) =>
        prisma.alocacaoMeta.upsert({
          where: { transacaoId: t.id },
          create: { transacaoId: t.id, metaId: vinculoId, valorCentavos: t.valorCentavos, data: t.data },
          update: { metaId: vinculoId, valorCentavos: t.valorCentavos, data: t.data },
        })
      )
    );
  }

  revalidatePath("/transacoes");
  revalidatePath("/passivos");
}

// Acha, de uma vez, os grupos de transações "provavelmente a mesma
// coisa" (descrição parecida ou valor repetido) entre o que ainda falta
// categoria/vínculo — em vez do Felipe ter que pensar num credor e buscar
// um de cada vez em "credor parecido". Só olha o que tem algo a resolver
// (categoria ou vínculo faltando), e respeita o mesmo filtro de
// tipo/período que a tela de /transacoes já usa, pra focar a varredura.
export async function buscarGruposSugeridos(filtros: {
  tipo?: "ENTRADA" | "DESPESA";
  periodo?: Periodo;
  categoriaId?: string;
}): Promise<GrupoSugerido[]> {
  const where: Prisma.TransacaoWhereInput = {
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
    data: { gte: inicioDoPeriodo(filtros.periodo ?? "tudo") },
    OR: [{ categoriaId: null }, { passivoId: null, ativoId: null, alocacaoMeta: null }],
  };

  const transacoes = await prisma.transacao.findMany({
    where,
    select: {
      id: true,
      descricao: true,
      valorCentavos: true,
      tipo: true,
      categoriaId: true,
      passivoId: true,
      ativoId: true,
      alocacaoMeta: { select: { metaId: true } },
    },
  });

  return encontrarGruposSugeridos(
    transacoes.map((t) => ({
      id: t.id,
      descricao: t.descricao,
      valorCentavos: t.valorCentavos,
      tipo: t.tipo,
      categoriaId: t.categoriaId,
      passivoId: t.passivoId,
      ativoId: t.ativoId,
      metaId: t.alocacaoMeta?.metaId ?? null,
    }))
  );
}

// Marca/desmarca em lote um grupo de transações como transferência entre
// contas próprias (TED/DOC/PIX pra pagar dívida, aporte em investimento
// etc.) — nem gasto nem receita de verdade, some dos relatórios de ofensor
// (src/lib/ofensores.ts) sem sair do extrato. Útil pra revisar de uma vez
// um lote de transferências antigas já importadas.
export async function marcarTransferenciaEmLote(ids: string[], ehTransferencia: boolean) {
  if (ids.length === 0) return;

  await prisma.transacao.updateMany({
    where: { id: { in: ids } },
    data: { ehTransferencia },
  });

  revalidatePath("/transacoes");
}

export async function atualizarCategoriaEmLote(ids: string[], categoriaId: string) {
  if (ids.length === 0 || !categoriaId) return;

  const afetadas = await prisma.transacao.findMany({
    where: { id: { in: ids } },
    select: { descricao: true, tipo: true },
  });

  await prisma.transacao.updateMany({
    where: { id: { in: ids } },
    data: { categoriaId },
  });

  // Ensina uma regra por padrão de descrição único no lote — reclassificar
  // em massa depois de organizar categorias também alimenta a sugestão
  // automática da próxima importação. Sem vínculo aqui: um lote pode
  // reunir descrições de credores diferentes (ex: vários PIX de doação),
  // então só a categoria é aprendida, não um passivo/ativo/meta específico.
  const padroesAprendidos = new Set<string>();
  for (const t of afetadas) {
    const chave = `${t.tipo}|${normalizarDescricao(t.descricao)}`;
    if (padroesAprendidos.has(chave)) continue;
    padroesAprendidos.add(chave);
    await aprenderRegraClassificacao({ descricao: t.descricao, tipo: t.tipo, categoriaId });
  }

  revalidatePath("/transacoes");
}
