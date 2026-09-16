import { prisma } from "@/lib/prisma";
import { ImportarFaturaForm } from "./ImportarFaturaForm";

export const dynamic = "force-dynamic";

export default async function ImportarFaturaPage() {
  const [cartoes, categorias] = await Promise.all([
    prisma.passivo.findMany({
      where: { status: "ATIVO", custoMensalVariavel: true },
      orderBy: { nome: "asc" },
    }),
    prisma.categoria.findMany({ orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Importar fatura de cartão</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Envie o PDF da fatura. O sistema tenta achar o total, o mínimo e o vencimento
          sozinho, mas bancos não têm formato padronizado — confira os valores antes de
          confirmar, e preencha à mão o que não vier certo.
        </p>
      </div>

      {cartoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum cartão marcado como &ldquo;custo mensal variável&rdquo; ainda. Marque essa opção
          na edição de um passivo do tipo cartão pra ele aparecer aqui.
        </p>
      ) : (
        <ImportarFaturaForm
          cartoes={cartoes.map((c) => ({ id: c.id, nome: c.nome }))}
          categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, parentId: c.parentId }))}
        />
      )}
    </div>
  );
}
