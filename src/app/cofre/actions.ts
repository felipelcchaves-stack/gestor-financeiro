"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";

function passivosDoForm(formData: FormData): string[] {
  return formData.getAll("passivosAlvo").map(String).filter(Boolean);
}

// Mesma criação de src/app/metas/actions.ts, só com contaOrigemId
// fixo (a conta do cofre) e redirecionando/revalidando pra cá em vez
// de /metas — a meta continua aparecendo em /metas normalmente também.
export async function criarMetaCofre(contaOrigemId: string, formData: FormData) {
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
      contaOrigemId,
      passivosAlvo: { create: passivoIds.map((passivoId) => ({ passivoId })) },
    },
  });

  revalidatePath("/cofre");
  redirect("/cofre");
}
