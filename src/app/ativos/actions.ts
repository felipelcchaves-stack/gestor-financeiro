"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { centavosDoForm, textoDoForm, floatDoForm } from "@/lib/form-helpers";
import type { TipoVinculoAtivoPassivo } from "@/generated/prisma";

function camposComuns(formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const liquidez = textoDoForm(formData, "liquidez");
  const valorCentavos = centavosDoForm(formData, "valor");

  if (!nome || !liquidez || valorCentavos == null) {
    throw new Error("Preencha nome, valor e liquidez.");
  }

  return {
    nome,
    liquidez,
    valorCentavos,
    rendimentoMensalPct: floatDoForm(formData, "rendimentoMensalPct"),
    observacao: textoDoForm(formData, "observacao"),
  };
}

export async function criarAtivo(formData: FormData) {
  const dados = camposComuns(formData);
  await prisma.ativo.create({ data: dados });
  revalidatePath("/ativos");
  redirect("/ativos");
}

// Mesma criação, sem redirect — usado pelo wizard de primeira carga
// (`/comecar`), que precisa ficar na mesma página entre os passos.
export async function criarAtivoSemRedirecionar(formData: FormData) {
  const dados = camposComuns(formData);
  const ativo = await prisma.ativo.create({ data: dados });
  revalidatePath("/ativos");
  return ativo;
}

export async function atualizarAtivo(id: string, formData: FormData) {
  const dados = camposComuns(formData);
  const atual = await prisma.ativo.findUniqueOrThrow({ where: { id } });

  await prisma.$transaction([
    prisma.ativo.update({ where: { id }, data: dados }),
    ...(atual.valorCentavos !== dados.valorCentavos
      ? [
          prisma.ativoHistorico.create({
            data: {
              ativoId: id,
              valorAnteriorCentavos: atual.valorCentavos,
              valorNovoCentavos: dados.valorCentavos,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath("/ativos");
  revalidatePath(`/ativos/${id}`);
  redirect(`/ativos/${id}`);
}

export async function vincularAtivoPassivo(ativoId: string, formData: FormData) {
  const passivoId = textoDoForm(formData, "passivoId");
  const tipoVinculoRaw = textoDoForm(formData, "tipoVinculo");
  const tipoVinculo: TipoVinculoAtivoPassivo = tipoVinculoRaw === "FINANCIAMENTO" ? "FINANCIAMENTO" : "GARANTIA";
  const valorGarantidoCentavos = tipoVinculo === "GARANTIA" ? centavosDoForm(formData, "valorGarantido") : null;
  if (!passivoId) throw new Error("Selecione um passivo.");

  await prisma.ativoPassivoVinculo.upsert({
    where: { ativoId_passivoId: { ativoId, passivoId } },
    create: { ativoId, passivoId, tipoVinculo, valorGarantidoCentavos },
    update: { tipoVinculo, valorGarantidoCentavos },
  });

  revalidatePath(`/ativos/${ativoId}`);
}

export async function removerVinculo(ativoId: string, vinculoId: string) {
  await prisma.ativoPassivoVinculo.delete({ where: { id: vinculoId } });
  revalidatePath(`/ativos/${ativoId}`);
}

export async function excluirAtivo(id: string) {
  const transacoesVinculadas = await prisma.transacao.count({ where: { ativoId: id } });
  if (transacoesVinculadas > 0) {
    throw new Error(
      `Não é possível excluir: há ${transacoesVinculadas} transação(ões) vinculada(s) a este ativo.`
    );
  }

  await prisma.$transaction([
    prisma.regraClassificacao.updateMany({ where: { ativoId: id }, data: { ativoId: null } }),
    prisma.ativo.delete({ where: { id } }),
  ]);

  revalidatePath("/ativos");
  redirect("/ativos");
}
