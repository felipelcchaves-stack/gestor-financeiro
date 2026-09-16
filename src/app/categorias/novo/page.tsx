import { prisma } from "@/lib/prisma";
import { CategoriaForm } from "../CategoriaForm";
import { criarCategoria } from "../actions";

export default async function NovaCategoriaPage() {
  const raizes = await prisma.categoria.findMany({ where: { parentId: null }, orderBy: { nome: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Nova categoria</h1>
      <CategoriaForm action={criarCategoria} raizesDisponiveis={raizes} />
    </div>
  );
}
