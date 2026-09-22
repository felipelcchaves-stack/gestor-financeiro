"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { Confiabilidade } from "@/generated/prisma";

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

// Documenta um mês PASSADO de memória — nunca calculado pelo sistema,
// sempre o número que o Felipe digitar. Existe pra não travar a
// evolução da dívida em um único ponto por meses só porque o botão de
// snapshot mensal só grava o mês corrente. Sempre marcado ESTIMADO, pra
// nunca se confundir com um snapshot calculado dos dados documentados.
export async function registrarSnapshotHistorico(formData: FormData) {
  const mesReferencia = textoDoForm(formData, "mesReferencia");
  const passivoTotalCentavos = centavosDoForm(formData, "passivoTotal");
  const ativoTotalCentavos = centavosDoForm(formData, "ativoTotal") ?? 0;

  if (mesReferencia == null || !/^\d{4}-\d{2}$/.test(mesReferencia)) {
    throw new Error("Informe um mês válido.");
  }
  if (passivoTotalCentavos == null || passivoTotalCentavos < 0) {
    throw new Error("Informe a dívida total daquele mês.");
  }

  const mesAtual = new Date().toISOString().slice(0, 7);
  if (mesReferencia >= mesAtual) {
    throw new Error("Use o botão \"Registrar patrimônio deste mês\" pro mês corrente — este campo é só pra meses passados.");
  }

  const existente = await prisma.patrimonioSnapshot.findUnique({ where: { mesReferencia } });
  if (existente) {
    throw new Error("Já existe um snapshot registrado pra esse mês.");
  }

  await prisma.patrimonioSnapshot.create({
    data: {
      mesReferencia,
      passivoTotalCentavos,
      ativoTotalCentavos,
      patrimonioLiquidoCentavos: ativoTotalCentavos - passivoTotalCentavos,
      confiabilidade: Confiabilidade.ESTIMADO,
    },
  });

  revalidatePath("/");
  revalidatePath("/resumo");
}
