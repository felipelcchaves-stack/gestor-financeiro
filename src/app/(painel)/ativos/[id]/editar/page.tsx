import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AtivoForm } from "../../AtivoForm";
import { atualizarAtivo } from "../../actions";

export default async function EditarAtivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ativo = await prisma.ativo.findUnique({ where: { id } });
  if (!ativo) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Editar ativo — {ativo.nome}</h1>
      <AtivoForm action={atualizarAtivo.bind(null, id)} ativo={ativo} modoEdicao />
    </div>
  );
}
