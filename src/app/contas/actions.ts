"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TipoConta } from "@/generated/prisma";
import { centavosDoForm, floatDoForm, intDoForm, textoDoForm } from "@/lib/form-helpers";

export async function criarConta(formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const tipo = formData.get("tipo") as TipoConta;

  if (!nome || !tipo) throw new Error("Preencha nome e tipo da conta.");

  await prisma.conta.create({
    data: {
      nome,
      tipo,
      limiteChequeEspecialCentavos: centavosDoForm(formData, "limiteChequeEspecial"),
      taxaJurosChequeEspecialPct: floatDoForm(formData, "taxaJurosChequeEspecial"),
      carenciaDiasChequeEspecial: intDoForm(formData, "carenciaDiasChequeEspecial"),
    },
  });

  revalidatePath("/contas");
  redirect("/contas");
}

// Mesma criação, sem redirect — usado pelo wizard de primeira carga
// (`/comecar`), que precisa ficar na mesma página entre os passos.
export async function criarContaSemRedirecionar(formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const tipo = formData.get("tipo") as TipoConta;

  if (!nome || !tipo) throw new Error("Preencha nome e tipo da conta.");

  const conta = await prisma.conta.create({
    data: {
      nome,
      tipo,
      limiteChequeEspecialCentavos: centavosDoForm(formData, "limiteChequeEspecial"),
      taxaJurosChequeEspecialPct: floatDoForm(formData, "taxaJurosChequeEspecial"),
      carenciaDiasChequeEspecial: intDoForm(formData, "carenciaDiasChequeEspecial"),
    },
  });

  revalidatePath("/contas");
  return conta;
}

export async function atualizarSaldoConta(id: string, formData: FormData) {
  const saldoAtualCentavos = centavosDoForm(formData, "saldo");
  if (saldoAtualCentavos == null) throw new Error("Informe o saldo atual.");

  await prisma.conta.update({
    where: { id },
    data: { saldoAtualCentavos, saldoAtualizadoEm: new Date() },
  });

  revalidatePath("/contas");
  revalidatePath("/consultor");
  revalidatePath("/cofre");
}

export async function excluirConta(id: string) {
  const transacoesVinculadas = await prisma.transacao.count({ where: { contaId: id } });
  if (transacoesVinculadas > 0) {
    throw new Error(
      `Não é possível excluir: há ${transacoesVinculadas} transação(ões) vinculada(s) a esta conta.`
    );
  }

  await prisma.conta.delete({ where: { id } });
  revalidatePath("/contas");
}
