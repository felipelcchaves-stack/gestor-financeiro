"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { floatDoForm, intDoForm, textoDoForm } from "@/lib/form-helpers";

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

export async function definirRateio(formData: FormData) {
  const categoriaRateioId = textoDoForm(formData, "categoriaRateioId");
  const percentualRateio = intDoForm(formData, "percentualRateio");
  const contaRateioDestinoId = textoDoForm(formData, "contaRateioDestinoId");

  if (!categoriaRateioId || percentualRateio == null || percentualRateio <= 0 || percentualRateio > 100 || !contaRateioDestinoId) {
    throw new Error("Preencha categoria, percentual (1-100) e conta destino.");
  }

  const atual = await prisma.configuracao.findUnique({ where: { id: "singleton" } });

  await prisma.configuracao.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      categoriaRateioId,
      percentualRateio,
      contaRateioDestinoId,
      rateioAtivoDesde: new Date(),
    },
    update: {
      categoriaRateioId,
      percentualRateio,
      contaRateioDestinoId,
      // Nunca reescreve a data de início numa edição — só grava na
      // primeira vez que a regra é criada.
      ...(atual?.rateioAtivoDesde ? {} : { rateioAtivoDesde: new Date() }),
    },
  });

  revalidatePath("/consultor");
  revalidatePath("/cofre");
  revalidatePath("/resumo/ia");
}
