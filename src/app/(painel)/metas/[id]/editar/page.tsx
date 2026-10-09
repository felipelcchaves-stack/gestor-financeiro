import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MetaForm } from "../../MetaForm";
import { atualizarMeta } from "../../actions";

export default async function EditarMetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [meta, passivos] = await Promise.all([
    prisma.meta.findUnique({ where: { id }, include: { passivosAlvo: true } }),
    prisma.passivo.findMany({ orderBy: { nome: "asc" } }),
  ]);
  if (!meta) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Editar meta — {meta.nome}</h1>
      <MetaForm action={atualizarMeta.bind(null, id)} meta={meta} passivosDisponiveis={passivos} modoEdicao />
    </div>
  );
}
