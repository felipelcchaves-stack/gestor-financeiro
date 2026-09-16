"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { calcularHashDedupe, aprenderRegraClassificacao } from "@/lib/classificacao";
import { TipoTransacao, OrigemTransacao } from "@/generated/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";

const STORAGE_DIR = path.join(process.cwd(), "storage", "documentos");

export async function confirmarLancamentoImagem(formData: FormData): Promise<{ transacaoId: string }> {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    throw new Error("Selecione a imagem.");
  }

  const contaId = textoDoForm(formData, "contaId");
  const dataRaw = textoDoForm(formData, "data");
  const descricao = textoDoForm(formData, "descricao");
  const valorCentavos = centavosDoForm(formData, "valor");
  const tipo = formData.get("tipo") === "ENTRADA" ? TipoTransacao.ENTRADA : TipoTransacao.DESPESA;
  const categoriaId = textoDoForm(formData, "categoriaId");
  const vinculoTipo = textoDoForm(formData, "vinculoTipo") ?? "NENHUM";
  const vinculoId = textoDoForm(formData, "vinculoId");

  if (!contaId || !dataRaw || !descricao || valorCentavos == null || !categoriaId) {
    throw new Error("Preencha conta, data, descrição, valor e categoria.");
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  await mkdir(STORAGE_DIR, { recursive: true });
  const extensao = path.extname(arquivo.name) || ".png";
  const nomeArmazenado = `${randomUUID()}${extensao}`;
  await writeFile(path.join(STORAGE_DIR, nomeArmazenado), buffer);

  const documento = await prisma.documento.create({
    data: {
      nomeArquivo: arquivo.name,
      tipo: "imagem",
      caminhoArquivo: path.join("storage", "documentos", nomeArmazenado),
    },
  });

  const data = new Date(dataRaw);
  const hashDedupe = calcularHashDedupe({ origemId: contaId, data, descricao, valorCentavos });

  const transacao = await prisma.transacao.create({
    data: {
      data,
      descricao,
      valorCentavos,
      tipo,
      origem: OrigemTransacao.IMAGEM,
      contaId,
      categoriaId,
      documentoId: documento.id,
      hashDedupe,
      passivoId: vinculoTipo === "PASSIVO" ? vinculoId : null,
      ativoId: vinculoTipo === "ATIVO" ? vinculoId : null,
    },
  });

  if (vinculoTipo === "META" && vinculoId) {
    await prisma.alocacaoMeta.create({
      data: { metaId: vinculoId, transacaoId: transacao.id, valorCentavos, data },
    });
  }

  await aprenderRegraClassificacao({
    descricao,
    tipo,
    categoriaId,
    passivoId: vinculoTipo === "PASSIVO" ? vinculoId : null,
    ativoId: vinculoTipo === "ATIVO" ? vinculoId : null,
    metaId: vinculoTipo === "META" ? vinculoId : null,
  });

  return { transacaoId: transacao.id };
}
