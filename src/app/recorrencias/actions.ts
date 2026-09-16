"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TipoTransacao, FrequenciaRecorrencia, Confiabilidade } from "@/generated/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";

function camposComuns(formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const tipo = formData.get("tipo") as TipoTransacao;
  const valorCentavos = centavosDoForm(formData, "valor");
  const frequencia = formData.get("frequencia") as FrequenciaRecorrencia;
  const confiabilidade = formData.get("confiabilidade") as Confiabilidade;
  const categoriaId = textoDoForm(formData, "categoriaId");
  const passivoId = textoDoForm(formData, "passivoId");
  const essencial = formData.get("essencial") === "1";

  if (!nome || !tipo || valorCentavos == null || !frequencia || !confiabilidade) {
    throw new Error("Preencha nome, tipo, valor, frequência e confiabilidade.");
  }

  return {
    nome,
    tipo,
    valorCentavos,
    frequencia,
    confiabilidade,
    categoriaId,
    passivoId,
    essencial,
    observacao: textoDoForm(formData, "observacao"),
  };
}

export async function criarRecorrencia(formData: FormData) {
  const dados = camposComuns(formData);
  await prisma.recorrenciaFinanceira.create({ data: dados });
  revalidatePath("/recorrencias");
  redirect("/recorrencias");
}

export async function atualizarRecorrencia(id: string, formData: FormData) {
  const dados = camposComuns(formData);
  await prisma.recorrenciaFinanceira.update({ where: { id }, data: dados });
  revalidatePath("/recorrencias");
  redirect("/recorrencias");
}

export async function alternarAtivaRecorrencia(id: string) {
  const atual = await prisma.recorrenciaFinanceira.findUniqueOrThrow({ where: { id } });
  await prisma.recorrenciaFinanceira.update({ where: { id }, data: { ativa: !atual.ativa } });
  revalidatePath("/recorrencias");
}

export async function excluirRecorrencia(id: string) {
  await prisma.recorrenciaFinanceira.delete({ where: { id } });
  revalidatePath("/recorrencias");
}
