"use server";

import { unlink } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Desfaz uma importação por completo — apaga as transações que vieram dela,
// o ciclo de fatura registrado (totais/vencimento) e o documento em si.
// AlocacaoMeta não cascade sozinho (mesma razão de excluirTransacao em
// src/app/transacoes/actions.ts), por isso precisa ser apagado antes das
// transações. Passivo.documentoFonteId e PassivoHistorico.documentoId
// citam o documento sem fazer parte da importação — ficam de fora da
// exclusão explícita, o Prisma já desvincula sozinho (SetNull) ao apagar
// o Documento, sem apagar o passivo nem o histórico.
export async function excluirDocumento(documentoId: string) {
  const documento = await prisma.documento.findUnique({
    where: { id: documentoId },
    select: { caminhoArquivo: true },
  });
  if (!documento) return;

  await prisma.$transaction([
    prisma.alocacaoMeta.deleteMany({ where: { transacao: { documentoId } } }),
    prisma.cicloFaturaPassivo.deleteMany({ where: { documentoId } }),
    prisma.transacao.deleteMany({ where: { documentoId } }),
    prisma.documento.delete({ where: { id: documentoId } }),
  ]);

  await unlink(path.join(process.cwd(), documento.caminhoArquivo)).catch(() => {});

  revalidatePath("/documentos");
  revalidatePath("/transacoes");
  revalidatePath("/cartoes");
  revalidatePath("/limite-cartao");
}
