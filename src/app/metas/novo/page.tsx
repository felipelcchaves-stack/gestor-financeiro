import { prisma } from "@/lib/prisma";
import { MetaForm } from "../MetaForm";
import { criarMeta } from "../actions";

export default async function NovaMetaPage() {
  const passivos = await prisma.passivo.findMany({ where: { status: "ATIVO" }, orderBy: { nome: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Nova meta</h1>
      <MetaForm action={criarMeta} passivosDisponiveis={passivos} />
    </div>
  );
}
