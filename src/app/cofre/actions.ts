"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";
import { somaValorPassivosCentavos } from "@/app/metas/actions";

function passivosDoForm(formData: FormData): string[] {
  return formData.getAll("passivosAlvo").map(String).filter(Boolean);
}

// Mesma criação de src/app/metas/actions.ts, só com contaOrigemId
// fixo (a conta do cofre) e redirecionando/revalidando pra cá em vez
// de /metas — a meta continua aparecendo em /metas normalmente também.
export async function criarMetaCofre(contaOrigemId: string, formData: FormData) {
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
      contaOrigemId,
      passivosAlvo: { create: passivoIds.map((passivoId) => ({ passivoId })) },
    },
  });

  revalidatePath("/cofre");
  redirect("/cofre");
}
