"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";

export async function definirOrcamento(formData: FormData) {
  const categoriaId = textoDoForm(formData, "categoriaId");
  const limiteMensalCentavos = centavosDoForm(formData, "limite");

  if (!categoriaId || limiteMensalCentavos == null || limiteMensalCentavos <= 0) {
    throw new Error("Selecione uma categoria e um limite maior que zero.");
  }

  await prisma.orcamentoCategoria.upsert({
    where: { categoriaId_referencia: { categoriaId, referencia: "recorrente" } },
    create: { categoriaId, referencia: "recorrente", limiteMensalCentavos },
    update: { limiteMensalCentavos },
  });

  revalidatePath("/ofensores");
}

export async function removerOrcamento(id: string) {
  await prisma.orcamentoCategoria.delete({ where: { id } });
  revalidatePath("/ofensores");
}
