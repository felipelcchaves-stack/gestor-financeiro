"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { centavosDoForm } from "@/lib/form-helpers";
import { carregarEstadoAtual } from "@/lib/estadoAtual";

export async function definirAporteMensal(formData: FormData) {
  const aporteMensalExtraCentavos = centavosDoForm(formData, "aporte");
  if (aporteMensalExtraCentavos == null || aporteMensalExtraCentavos <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }

  await prisma.configuracao.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", aporteMensalExtraCentavos },
    update: { aporteMensalExtraCentavos },
  });

  revalidatePath("/");
  revalidatePath("/otimizacao");
}

export async function registrarSnapshotMensal() {
  const estado = await carregarEstadoAtual();
  const mesReferencia = estado.hoje.toISOString().slice(0, 7);

  await prisma.patrimonioSnapshot.upsert({
    where: { mesReferencia },
    create: {
      mesReferencia,
      patrimonioLiquidoCentavos: estado.patrimonio,
      ativoTotalCentavos: estado.ativoTotal,
      passivoTotalCentavos: estado.passivoTotal,
    },
    update: {
      patrimonioLiquidoCentavos: estado.patrimonio,
      ativoTotalCentavos: estado.ativoTotal,
      passivoTotalCentavos: estado.passivoTotal,
    },
  });

  revalidatePath("/");
  revalidatePath("/resumo");
}
