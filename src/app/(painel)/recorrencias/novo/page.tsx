import { prisma } from "@/lib/prisma";
import { RecorrenciaForm } from "../RecorrenciaForm";
import { criarRecorrencia } from "../actions";

export default async function NovaRecorrenciaPage() {
  const [categorias, cartoes] = await Promise.all([
    prisma.categoria.findMany({ orderBy: { nome: "asc" } }),
    prisma.passivo.findMany({ where: { tipo: "cartao", status: "ATIVO" }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Nova recorrência</h1>
      <RecorrenciaForm action={criarRecorrencia} categorias={categorias} cartoes={cartoes} />
    </div>
  );
}
