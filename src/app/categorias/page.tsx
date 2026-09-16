import { Fragment } from "react";
import Link from "next/link";
import { Tags } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ConfirmForm";
import { excluirCategoria } from "./actions";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const categorias = await prisma.categoria.findMany({
    orderBy: [{ nome: "asc" }],
    include: {
      _count: {
        select: { transacoes: true, regras: true, recorrencias: true, subcategorias: true },
      },
    },
  });

  const raizes = categorias.filter((c) => c.parentId === null);
  const filhasPorPai = new Map<string, typeof categorias>();
  for (const c of categorias) {
    if (c.parentId) filhasPorPai.set(c.parentId, [...(filhasPorPai.get(c.parentId) ?? []), c]);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Categorias"
        description="Árvore de categorias usada pra classificar transações, orçamentos e recorrências."
        action={
          <Button nativeButton={false} render={<Link href="/categorias/novo" />}>
            <Tags className="size-4" /> Nova categoria
          </Button>
        }
      />

      {raizes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada ainda.</p>
      ) : (
        <div className="overflow-x-auto glass-card rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Vínculos</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {raizes.map((raiz) => (
                <Fragment key={raiz.id}>
                  <CategoriaRow categoria={raiz} />
                  {(filhasPorPai.get(raiz.id) ?? []).map((filha) => (
                    <CategoriaRow key={filha.id} categoria={filha} filha />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type CategoriaComContagem = {
  id: string;
  nome: string;
  _count: { transacoes: number; regras: number; recorrencias: number; subcategorias: number };
};

function CategoriaRow({ categoria, filha = false }: { categoria: CategoriaComContagem; filha?: boolean }) {
  const vinculos = [
    categoria._count.subcategorias > 0 ? `${categoria._count.subcategorias} subcategoria(s)` : null,
    categoria._count.transacoes > 0 ? `${categoria._count.transacoes} transação(ões)` : null,
    categoria._count.regras > 0 ? `${categoria._count.regras} regra(s)` : null,
    categoria._count.recorrencias > 0 ? `${categoria._count.recorrencias} recorrência(s)` : null,
  ].filter((v): v is string => v !== null);

  return (
    <tr>
      <td className={`px-4 py-3 text-foreground ${filha ? "pl-8 text-muted-foreground" : "font-medium"}`}>
        {filha ? "— " : ""}
        {categoria.nome}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{vinculos.length > 0 ? vinculos.join(" · ") : "—"}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3 text-xs">
          <Link href={`/categorias/${categoria.id}/editar`} className="text-muted-foreground/70 hover:text-foreground">
            editar
          </Link>
          <ConfirmForm
            action={excluirCategoria.bind(null, categoria.id)}
            confirmMessage={`Excluir a categoria "${categoria.nome}"? Essa ação não pode ser desfeita.`}
          >
            <button type="submit" className="text-muted-foreground/70 hover:text-debt">
              excluir
            </button>
          </ConfirmForm>
        </div>
      </td>
    </tr>
  );
}
