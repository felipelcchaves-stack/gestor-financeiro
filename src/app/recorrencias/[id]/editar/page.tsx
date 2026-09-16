import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecorrenciaForm } from "../../RecorrenciaForm";
import { atualizarRecorrencia } from "../../actions";

export default async function EditarRecorrenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [recorrencia, categorias, cartoes] = await Promise.all([
    prisma.recorrenciaFinanceira.findUnique({ where: { id } }),
    prisma.categoria.findMany({ orderBy: { nome: "asc" } }),
    prisma.passivo.findMany({ where: { tipo: "cartao", status: "ATIVO" }, orderBy: { nome: "asc" } }),
  ]);
  if (!recorrencia) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Editar recorrência — {recorrencia.nome}</h1>
      <RecorrenciaForm
        action={atualizarRecorrencia.bind(null, id)}
        recorrencia={recorrencia}
        categorias={categorias}
        cartoes={cartoes}
        modoEdicao
      />
    </div>
  );
}
