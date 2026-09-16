"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { intDoForm, textoDoForm } from "@/lib/form-helpers";

const ESTRATEGIAS_VALIDAS = ["menorTempo", "menorJuros", "maiorAlivio", "hibrida"];

// Deixa explícito qual critério de ataque às dívidas o Felipe escolheu usar
// de verdade (em vez do sistema sempre impor "menor juro" silenciosamente)
// — propaga pra trilha do Mapa e pro gráfico de saldo por credor em
// /ofensores via src/lib/estadoAtual.ts.
export async function definirEstrategiaEscolhida(formData: FormData) {
  const estrategiaEscolhida = textoDoForm(formData, "estrategia");
  if (!estrategiaEscolhida || !ESTRATEGIAS_VALIDAS.includes(estrategiaEscolhida)) {
    throw new Error("Estratégia inválida.");
  }

  const splitHibridoPct = estrategiaEscolhida === "hibrida" ? intDoForm(formData, "splitHibridoPct") : null;

  await prisma.configuracao.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", estrategiaEscolhida, splitHibridoPct },
    update: { estrategiaEscolhida, splitHibridoPct },
  });

  revalidatePath("/");
  revalidatePath("/otimizacao");
  revalidatePath("/ofensores");
}
