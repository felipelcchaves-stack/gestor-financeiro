"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusMeta } from "@/generated/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";

function passivosDoForm(formData: FormData): string[] {
  return formData.getAll("passivosAlvo").map(String).filter(Boolean);
}

// Quando a meta já mira passivo(s) com saldo documentado, o valor-alvo
// devia vir de lá, não de um número digitado à parte (que
// calcularProgressoMeta em src/lib/metrics.ts já ignora nesse caso —
// o formulário só não deixava isso claro). Retorna null quando nenhum
// passivo tem saldo documentado, pra quem chamar decidir se isso é
// erro (nada informado em lugar nenhum) ou não.
export async function somaValorPassivosCentavos(passivoIds: string[]): Promise<number | null> {
  if (passivoIds.length === 0) return null;
  const passivos = await prisma.passivo.findMany({
    where: { id: { in: passivoIds } },
    select: { valorQuitacaoCentavos: true },
  });
  const valores = passivos.filter((p): p is { valorQuitacaoCentavos: number } => p.valorQuitacaoCentavos != null);
  if (valores.length === 0) return null;
  return valores.reduce((acc, p) => acc + p.valorQuitacaoCentavos, 0);
}

export async function criarMeta(formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const valorAlvoInformado = centavosDoForm(formData, "valorAlvo");
  const dataAlvoRaw = textoDoForm(formData, "dataAlvo");
  const passivoIds = passivosDoForm(formData);

  if (!nome || !dataAlvoRaw) throw new Error("Preencha nome e data-alvo.");

  const valorAlvoCentavos = valorAlvoInformado ?? (await somaValorPassivosCentavos(passivoIds));
  if (valorAlvoCentavos == null) {
    throw new Error("Informe o valor-alvo, ou marque um passivo-alvo com saldo de quitação documentado.");
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
  const valorAlvoInformado = centavosDoForm(formData, "valorAlvo");
  const dataAlvoRaw = textoDoForm(formData, "dataAlvo");
  const passivoIds = passivosDoForm(formData);

  if (!nome || !dataAlvoRaw) throw new Error("Preencha nome e data-alvo.");

  const valorAlvoCentavos = valorAlvoInformado ?? (await somaValorPassivosCentavos(passivoIds));
  if (valorAlvoCentavos == null) {
    throw new Error("Informe o valor-alvo, ou marque um passivo-alvo com saldo de quitação documentado.");
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
  const valorAlvoInformado = centavosDoForm(formData, "valorAlvo");
  const dataAlvoRaw = textoDoForm(formData, "dataAlvo");
  const status = formData.get("status") as StatusMeta;
  const passivoIds = passivosDoForm(formData);

  if (!nome || !dataAlvoRaw) throw new Error("Preencha nome e data-alvo.");

  const valorAlvoCentavos = valorAlvoInformado ?? (await somaValorPassivosCentavos(passivoIds));
  if (valorAlvoCentavos == null) {
    throw new Error("Informe o valor-alvo, ou marque um passivo-alvo com saldo de quitação documentado.");
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

