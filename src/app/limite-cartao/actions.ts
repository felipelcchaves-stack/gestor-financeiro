"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { centavosDoForm } from "@/lib/form-helpers";

export async function definirLimiteCartao(passivoId: string, formData: FormData) {
  const limiteCartaoCentavos = centavosDoForm(formData, "limite");
  if (limiteCartaoCentavos == null || limiteCartaoCentavos < 0) {
    throw new Error("Informe um limite válido.");
  }

  await prisma.passivo.update({ where: { id: passivoId }, data: { limiteCartaoCentavos } });
  revalidatePath("/limite-cartao");
}

export async function definirMetaGastoMensal(passivoId: string, formData: FormData) {
  const metaGastoMensalCentavos = centavosDoForm(formData, "meta");
  if (metaGastoMensalCentavos == null || metaGastoMensalCentavos < 0) {
    throw new Error("Informe uma meta válida.");
  }

  await prisma.passivo.update({ where: { id: passivoId }, data: { metaGastoMensalCentavos } });
  revalidatePath("/limite-cartao");
  revalidatePath("/cartoes");
}
