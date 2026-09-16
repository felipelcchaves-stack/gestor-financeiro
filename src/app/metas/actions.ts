"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusMeta } from "@/generated/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";

function passivosDoForm(formData: FormData): string[] {
  return formData.getAll("passivosAlvo").map(String).filter(Boolean);
}

export async function criarMeta(formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const valorAlvoCentavos = centavosDoForm(formData, "valorAlvo");
  const dataAlvoRaw = textoDoForm(formData, "dataAlvo");
  const passivoIds = passivosDoForm(formData);

  if (!nome || valorAlvoCentavos == null || !dataAlvoRaw) {
    throw new Error("Preencha nome, valor-alvo e data-alvo.");
  }

  await prisma.meta.create({
    data: {
      nome,
      valorAlvoCentavos,
      dataAlvo: new Date(dataAlvoRaw),
      passivosAlvo: { create: passivoIds.map((passivoId) => ({ passivoId })) },
    },
  });

  revalidatePath("/metas");
  redirect("/metas");
}

// Mesma criação, sem redirect — usado pelo wizard de primeira carga
// (`/comecar`), que precisa ficar na mesma página entre os passos.
export async function criarMetaSemRedirecionar(formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const valorAlvoCentavos = centavosDoForm(formData, "valorAlvo");
  const dataAlvoRaw = textoDoForm(formData, "dataAlvo");
  const passivoIds = passivosDoForm(formData);

  if (!nome || valorAlvoCentavos == null || !dataAlvoRaw) {
    throw new Error("Preencha nome, valor-alvo e data-alvo.");
  }

  const meta = await prisma.meta.create({
    data: {
      nome,
      valorAlvoCentavos,
      dataAlvo: new Date(dataAlvoRaw),
      passivosAlvo: { create: passivoIds.map((passivoId) => ({ passivoId })) },
    },
  });

  revalidatePath("/metas");
  return meta;
}

export async function atualizarMeta(id: string, formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const valorAlvoCentavos = centavosDoForm(formData, "valorAlvo");
  const dataAlvoRaw = textoDoForm(formData, "dataAlvo");
  const status = formData.get("status") as StatusMeta;
  const passivoIds = passivosDoForm(formData);

  if (!nome || valorAlvoCentavos == null || !dataAlvoRaw) {
    throw new Error("Preencha nome, valor-alvo e data-alvo.");
  }

  await prisma.$transaction([
    prisma.metaPassivo.deleteMany({ where: { metaId: id } }),
    prisma.meta.update({
      where: { id },
      data: {
        nome,
        valorAlvoCentavos,
        dataAlvo: new Date(dataAlvoRaw),
        status,
        passivosAlvo: { create: passivoIds.map((passivoId) => ({ passivoId })) },
      },
    }),
  ]);

  revalidatePath("/metas");
  redirect("/metas");
}

export async function excluirMeta(id: string) {
  await prisma.$transaction([
    prisma.regraClassificacao.updateMany({ where: { metaId: id }, data: { metaId: null } }),
    prisma.meta.delete({ where: { id } }),
  ]);

  revalidatePath("/metas");
}

