import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoriaForm } from "../../CategoriaForm";
import { atualizarCategoria } from "../../actions";

export default async function EditarCategoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [categoria, raizes] = await Promise.all([
    prisma.categoria.findUnique({ where: { id } }),
    prisma.categoria.findMany({ where: { parentId: null }, orderBy: { nome: "asc" } }),
  ]);
  if (!categoria) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Editar categoria — {categoria.nome}</h1>
      <CategoriaForm
        action={atualizarCategoria.bind(null, id)}
        categoria={categoria}
        raizesDisponiveis={raizes.filter((r) => r.id !== id)}
        modoEdicao
      />
    </div>
  );
}
