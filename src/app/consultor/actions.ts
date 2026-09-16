"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { floatDoForm } from "@/lib/form-helpers";

export async function definirTaxaReferencia(formData: FormData) {
  const taxaReferenciaMensalPct = floatDoForm(formData, "taxa");
  if (taxaReferenciaMensalPct == null || taxaReferenciaMensalPct < 0) {
    throw new Error("Informe uma taxa válida (0 ou maior).");
  }

  await prisma.configuracao.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", taxaReferenciaMensalPct },
    update: { taxaReferenciaMensalPct },
  });

  revalidatePath("/consultor");
}
