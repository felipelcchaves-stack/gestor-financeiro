import { prisma } from "@/lib/prisma";
import { ImportarExtratoForm } from "./ImportarExtratoForm";

export const dynamic = "force-dynamic";

export default async function ImportarExtratoPage() {
  const [contas, categorias, passivos, ativos, metas] = await Promise.all([
    prisma.conta.findMany({ orderBy: { nome: "asc" } }),
    prisma.categoria.findMany({ orderBy: { nome: "asc" } }),
    prisma.passivo.findMany({ where: { status: "ATIVO" }, orderBy: { nome: "asc" } }),
    prisma.ativo.findMany({ orderBy: { nome: "asc" } }),
    prisma.meta.findMany({ where: { status: "ATIVA" }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Importar extrato</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie o PDF do extrato bancário. Nada é gravado até você revisar e confirmar a
          classificação de cada lançamento.
        </p>
      </div>

      <ImportarExtratoForm
        contas={contas.map((c) => ({ id: c.id, nome: c.nome }))}
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, parentId: c.parentId }))}
        passivos={passivos.map((p) => ({ id: p.id, nome: p.nome }))}
        ativos={ativos.map((a) => ({ id: a.id, nome: a.nome }))}
        metas={metas.map((m) => ({ id: m.id, nome: m.nome }))}
      />
    </div>
  );
}
