"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { textoDoForm } from "@/lib/form-helpers";

// Variante sem redirect, usada por telas que criam uma categoria/subcategoria
// inline durante a revisão de lançamentos (importação de extrato, tabela de
// transações) e continuam na mesma tela em vez de navegar pra /categorias.
export async function criarCategoriaAction(nome: string, parentId: string | null) {
  const nomeTratado = nome.trim();
  if (nomeTratado.length === 0) throw new Error("Nome da categoria não pode ser vazio.");

  const categoria = await prisma.categoria.create({
    data: { nome: nomeTratado, parentId: parentId || null },
  });
  revalidatePath("/categorias");
  return categoria;
}

export async function criarCategoria(formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const parentId = textoDoForm(formData, "parentId");
  if (!nome) throw new Error("Preencha o nome da categoria.");

  await prisma.categoria.create({ data: { nome, parentId } });
  revalidatePath("/categorias");
  redirect("/categorias");
}

export async function atualizarCategoria(id: string, formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const parentId = textoDoForm(formData, "parentId");
  if (!nome) throw new Error("Preencha o nome da categoria.");
  if (parentId === id) throw new Error("Uma categoria não pode ser mãe dela mesma.");

  await prisma.categoria.update({ where: { id }, data: { nome, parentId } });
  revalidatePath("/categorias");
  redirect("/categorias");
}

export async function excluirCategoria(id: string) {
  const [subcategorias, transacoes, regras, recorrencias] = await Promise.all([
    prisma.categoria.count({ where: { parentId: id } }),
    prisma.transacao.count({ where: { categoriaId: id } }),
    prisma.regraClassificacao.count({ where: { categoriaId: id } }),
    prisma.recorrenciaFinanceira.count({ where: { categoriaId: id } }),
  ]);

  const bloqueios = [
    subcategorias > 0 ? `${subcategorias} subcategoria(s)` : null,
    transacoes > 0 ? `${transacoes} transação(ões)` : null,
    regras > 0 ? `${regras} regra(s) de classificação` : null,
    recorrencias > 0 ? `${recorrencias} recorrência(s)` : null,
  ].filter((v): v is string => v !== null);

  if (bloqueios.length > 0) {
    throw new Error(`Não é possível excluir: há ${bloqueios.join(", ")} vinculado(s) a esta categoria.`);
  }

  await prisma.categoria.delete({ where: { id } });
  revalidatePath("/categorias");
}
