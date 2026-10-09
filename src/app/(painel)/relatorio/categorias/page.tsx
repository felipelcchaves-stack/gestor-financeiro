import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import { calcularMaioresOfensores, inicioDoPeriodo, type CategoriaComDetalhe, type Periodo } from "@/lib/ofensores";
import { ordenarCategoriasHierarquicamente, calcularTipoPredominantePorCategoria } from "@/lib/categorias";
import { TipoTransacao } from "@/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const LABEL_PERIODO: Record<Periodo, string> = {
  mes: "Este mês",
  trimestre: "Trimestre",
  semestre: "6 meses",
  ano: "Este ano",
  tudo: "Todo o histórico",
};

// Categoria raiz marcada = mostra ela inteira (todas as subcategorias);
// só subcategorias marcadas = mostra só essas, com o total recalculado
// pra refletir exatamente o que foi escolhido, não o total da raiz
// inteira.
function filtrarRanking(itens: CategoriaComDetalhe[], selecionados: Set<string>): CategoriaComDetalhe[] {
  if (selecionados.size === 0) return itens;
  const resultado: CategoriaComDetalhe[] = [];
  for (const item of itens) {
    if (selecionados.has(item.id)) {
      resultado.push(item);
      continue;
    }
    const subsSelecionadas = item.subcategorias.filter((s) => selecionados.has(s.id));
    if (subsSelecionadas.length > 0) {
      resultado.push({
        ...item,
        totalCentavos: subsSelecionadas.reduce((acc, s) => acc + s.totalCentavos, 0),
        subcategorias: subsSelecionadas,
      });
    }
  }
  return resultado;
}

function Ranking({ itens, corTotal }: { itens: CategoriaComDetalhe[]; corTotal: string }) {
  if (itens.length === 0) {
    return <p className="text-sm text-muted-foreground">Nada classificado nesse período (ou filtro).</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {itens.map((item) => (
        <div key={item.id} className="glass-card rounded-2xl p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-medium text-foreground">{item.nome}</span>
            <span className={`font-semibold ${corTotal}`}>{formatarBRL(item.totalCentavos)}</span>
          </div>
          {item.subcategorias.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
              {item.subcategorias.map((s) => (
                <li key={s.id} className="flex justify-between text-sm text-muted-foreground">
                  <span>{s.nome}</span>
                  <span>{formatarBRL(s.totalCentavos)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function RelatorioCategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; categorias?: string | string[] }>;
}) {
  const { periodo: periodoRaw, categorias: categoriasRaw } = await searchParams;
  const periodo: Periodo =
    periodoRaw === "trimestre" || periodoRaw === "semestre" || periodoRaw === "ano" || periodoRaw === "tudo"
      ? periodoRaw
      : "mes";
  const selecionados = new Set(
    categoriasRaw == null ? [] : Array.isArray(categoriasRaw) ? categoriasRaw : [categoriasRaw]
  );

  const desde = inicioDoPeriodo(periodo);

  const [despesasBrutas, receitasBrutas, categorias, contagensCategoriaTipo] = await Promise.all([
    calcularMaioresOfensores(desde, TipoTransacao.DESPESA),
    calcularMaioresOfensores(desde, TipoTransacao.ENTRADA),
    prisma.categoria.findMany({ select: { id: true, nome: true, parentId: true } }),
    prisma.transacao.groupBy({ by: ["categoriaId", "tipo"], _count: { _all: true }, where: { categoriaId: { not: null } } }),
  ]);

  const tipoPorCategoria = calcularTipoPredominantePorCategoria(
    contagensCategoriaTipo.map((c) => ({ categoriaId: c.categoriaId!, tipo: c.tipo, quantidade: c._count._all }))
  );

  // Categoria raiz com subcategorias (ex: Empréstimo por credor, Cartão de
  // Crédito por cartão) quase nunca recebe transação diretamente nela — só
  // nas subcategorias. Filtrar só pelo tipo da própria categoria faz a raiz
  // sumir do filtro (nenhuma transação com categoriaId = raiz) e, com ela,
  // as subcategorias somem também: ordenarCategoriasHierarquicamente só
  // emite uma filha se a raiz dela também estiver na lista. Por isso a raiz
  // conta como "do tipo" se ela mesma tiver transação OU se qualquer
  // subcategoria dela tiver.
  const ehDoTipo = (c: { id: string; parentId: string | null }, tipo: TipoTransacao) =>
    tipoPorCategoria[c.id] === tipo || (c.parentId === null && categorias.some((f) => f.parentId === c.id && tipoPorCategoria[f.id] === tipo));

  const categoriasDespesa = categorias.filter((c) => ehDoTipo(c, TipoTransacao.DESPESA));
  const categoriasReceita = categorias.filter((c) => ehDoTipo(c, TipoTransacao.ENTRADA));

  const despesas = filtrarRanking(despesasBrutas, selecionados);
  const receitas = filtrarRanking(receitasBrutas, selecionados);

  const totalDespesasCentavos = despesas.reduce((acc, i) => acc + i.totalCentavos, 0);
  const totalReceitasCentavos = receitas.reduce((acc, i) => acc + i.totalCentavos, 0);
  const saldoCentavos = totalReceitasCentavos - totalDespesasCentavos;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Ferramentas"
        title="Relatório por categoria"
        description="Quanto você gasta e recebe em cada categoria, filtrando por período — pra achar onde cortar e sobrar mais pra quitar dívida."
      />

      <div className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(LABEL_PERIODO) as Periodo[]).map((p) => (
          <Link
            key={p}
            href={`/relatorio/categorias?periodo=${p}${
              selecionados.size > 0 ? `&${Array.from(selecionados).map((id) => `categorias=${id}`).join("&")}` : ""
            }`}
            className={`rounded-lg px-3 py-1 ${
              p === periodo ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"
            }`}
          >
            {LABEL_PERIODO[p]}
          </Link>
        ))}
      </div>

      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <p className="text-xs font-semibold uppercase tracking-wider">Saldo do período{selecionados.size > 0 ? " (categorias filtradas)" : ""}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Receitas</p>
            <p className="num text-2xl font-semibold text-liquidity">{formatarBRL(totalReceitasCentavos)}</p>
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Despesas</p>
            <p className="num text-2xl font-semibold text-debt">{formatarBRL(totalDespesasCentavos)}</p>
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo</p>
            <p className={`num text-2xl font-semibold ${saldoCentavos >= 0 ? "text-liquidity" : "text-debt"}`}>
              {formatarBRL(saldoCentavos)}
            </p>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Filtrar por categoria</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Marque uma categoria raiz pra ver ela inteira (com subcategorias), ou só subcategorias específicas pra ver
          só essas. Nenhuma marcada = mostra tudo.
        </p>
        <form method="get" className="mt-3 flex flex-col gap-4">
          <input type="hidden" name="periodo" value={periodo} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-debt">Despesa</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {ordenarCategoriasHierarquicamente(categoriasDespesa).map((c) => (
                  <li key={c.id}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="categorias" value={c.id} defaultChecked={selecionados.has(c.id)} />
                      {c.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-liquidity">Receita</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {ordenarCategoriasHierarquicamente(categoriasReceita).map((c) => (
                  <li key={c.id}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="categorias" value={c.id} defaultChecked={selecionados.has(c.id)} />
                      {c.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm">
              Aplicar filtro
            </Button>
            {selecionados.size > 0 && (
              <Link href={`/relatorio/categorias?periodo=${periodo}`} className="text-xs text-gold underline underline-offset-4">
                Limpar filtro
              </Link>
            )}
          </div>
        </form>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-foreground">Despesas por categoria</h2>
          <div className="mt-3">
            <Ranking itens={despesas} corTotal="text-debt" />
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-foreground">Receitas por categoria</h2>
          <div className="mt-3">
            <Ranking itens={receitas} corTotal="text-liquidity" />
          </div>
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        Pra orçamento por categoria, trajetória de saldo por credor e o comparativo mensal em gráfico, veja{" "}
        <Link href="/ofensores" className="text-gold underline underline-offset-4">
          Maiores ofensores
        </Link>
        .
      </p>
    </div>
  );
}
