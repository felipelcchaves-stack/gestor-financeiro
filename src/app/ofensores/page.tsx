import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import {
  calcularMaioresOfensores,
  calcularOfensoresPorCredor,
  calcularTendenciaMensal,
  calcularTrajetoriaRealPassivo,
  inicioDoPeriodo,
  type Periodo,
  type ProjecaoCredor,
} from "@/lib/ofensores";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { definirOrcamento, removerOrcamento } from "./actions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { GraficoComparativoMensal } from "./GraficoComparativoMensal";
import { TrajetoriaCredorChart } from "./TrajetoriaCredorChart";

export const dynamic = "force-dynamic";

const LABEL_PERIODO: Record<Periodo, string> = {
  mes: "Este mês",
  trimestre: "Trimestre",
  semestre: "6 meses",
  ano: "Este ano",
  tudo: "Todo o histórico",
};

type Visao = "categoria" | "credor";

export default async function OfensoresPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; visao?: string }>;
}) {
  const { periodo: periodoRaw, visao: visaoRaw } = await searchParams;
  const periodo: Periodo =
    periodoRaw === "trimestre" || periodoRaw === "semestre" || periodoRaw === "ano" || periodoRaw === "tudo"
      ? periodoRaw
      : "mes";
  const visao: Visao = visaoRaw === "credor" ? "credor" : "categoria";

  const desde = inicioDoPeriodo(periodo);

  const [rankingCategoria, rankingCredor, estado, categorias, orcamentos] = await Promise.all([
    visao === "categoria" ? calcularMaioresOfensores(desde) : Promise.resolve(null),
    visao === "credor" ? calcularOfensoresPorCredor(desde) : Promise.resolve(null),
    visao === "credor" ? carregarEstadoAtual() : Promise.resolve(null),
    prisma.categoria.findMany({ orderBy: { nome: "asc" } }),
    prisma.orcamentoCategoria.findMany({ where: { referencia: "recorrente" }, include: { categoria: true } }),
  ]);

  const ranking = rankingCategoria ?? (rankingCredor ?? []).map((item) => ({ ...item, subcategorias: [] }));

  // Fôlego que cada passivo ainda dá por mês (custoMensalCentavos) e daqui a
  // quantos meses ele quita na rota já escolhida — alimenta tanto a
  // projeção futura da Tendência mensal quanto o gráfico de saldo por
  // credor abaixo. Só existe na visão "por credor" (não faz sentido pra
  // categoria) e só quando há uma rota calculada (aporte mensal definido).
  const projecaoPorCredor = new Map<string, ProjecaoCredor>();
  if (estado?.rota) {
    for (const p of estado.elegiveis) {
      const quitacao = estado.rota.resultado.quitacoes.find((q) => q.passivoId === p.id);
      projecaoPorCredor.set(p.id, { custoMensalCentavos: p.custoMensalCentavos, mesesAtePagar: quitacao?.mes ?? null });
    }
  }

  // A comparação mês a mês usa sempre os últimos 12 meses fixos — não o
  // período escolhido no topo da página. Se dependesse desse filtro,
  // comparar ofensores de verdade exigiria trocar pra "Ano"/"Todo o
  // histórico", e aí os blocos do ranking acima virariam soma do período
  // inteiro em vez da foto do período selecionado. Sem projeção aqui: essa
  // seção é só olhar pra trás (a projeção de saldo devedor por credor
  // continua existindo, sem mudança, no gráfico individual de cada credor).
  const hoje = new Date();
  const desdeComparativo = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
  const tendenciaComparativa = await calcularTendenciaMensal(desdeComparativo, visao);

  const trajetoriasReais =
    visao === "credor"
      ? new Map(
          await Promise.all(
            ranking
              .filter((item) => item.id !== "sem-vinculo")
              .map(async (item) => [item.id, await calcularTrajetoriaRealPassivo(item.id)] as const)
          )
        )
      : new Map();

  const usoPorCategoria = new Map<string, number>();
  if (orcamentos.length > 0) {
    const transacoesMes = await prisma.transacao.findMany({
      where: {
        tipo: "DESPESA",
        ehTransferencia: false,
        data: { gte: inicioDoPeriodo("mes") },
        categoriaId: { in: orcamentos.map((o) => o.categoriaId) },
      },
      select: { categoriaId: true, valorCentavos: true },
    });
    for (const t of transacoesMes) {
      if (!t.categoriaId) continue;
      usoPorCategoria.set(t.categoriaId, (usoPorCategoria.get(t.categoriaId) ?? 0) + t.valorCentavos);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Ferramentas"
        title="Maiores ofensores"
        description="Com o que você tá gastando mais — sem precisar reconstruir isso de cabeça a partir do extrato."
      />

      <p className="-mt-4 text-xs text-muted-foreground">
        Quer ver despesa e receita lado a lado, com filtro por categoria específica?{" "}
        <Link href="/relatorio/categorias" className="text-gold underline underline-offset-4">
          Relatório por categoria
        </Link>
        .
      </p>

      <div className="flex gap-2 text-sm">
        {(Object.keys(LABEL_PERIODO) as Periodo[]).map((p) => (
          <Link
            key={p}
            href={`/ofensores?periodo=${p}&visao=${visao}`}
            className={`rounded-lg px-3 py-1 ${
              p === periodo ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"
            }`}
          >
            {LABEL_PERIODO[p]}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs text-muted-foreground">ver por:</span>
        <Link
          href={`/ofensores?periodo=${periodo}&visao=categoria`}
          className={`rounded-lg px-3 py-1 ${
            visao === "categoria" ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"
          }`}
        >
          Categoria
        </Link>
        <Link
          href={`/ofensores?periodo=${periodo}&visao=credor`}
          className={`rounded-lg px-3 py-1 ${
            visao === "credor" ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"
          }`}
        >
          Credor
        </Link>
        {visao === "credor" ? (
          <span className="text-xs text-muted-foreground">
            agrupado pelo passivo vinculado a cada lançamento — &ldquo;sem vínculo&rdquo; é o que ainda não foi ligado
            a nenhum credor.
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            aqui, dívidas da mesma categoria raiz somam juntas (ex: Agiota + Leka 1 + Leka 2 + consignados aparecem
            somados como &ldquo;Empréstimo&rdquo;) — troque pra &ldquo;Credor&rdquo; pra ver cada uma separada.
          </span>
        )}
      </div>

      {ranking.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda sem despesas classificadas nesse período.{" "}
          <Link href="/importar/extrato" className="underline">
            Importe um extrato
          </Link>{" "}
          pra começar a ver esse ranking.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {ranking.map((item) => {
            const trajetoriaReal = trajetoriasReais.get(item.id);
            const projecao = projecaoPorCredor.get(item.id);
            const projetadoCentavos =
              estado?.rota && projecao?.mesesAtePagar != null
                ? estado.rota.resultado.trajetoriaPorPassivoCentavos[item.id]
                : null;

            return (
              <div key={item.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-foreground">{item.nome}</span>
                  <span className="font-semibold text-debt">{formatarBRL(item.totalCentavos)}</span>
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
                {trajetoriaReal && trajetoriaReal.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <TrajetoriaCredorChart
                      nome={item.nome}
                      real={trajetoriaReal}
                      projetado={projetadoCentavos}
                      mesQuitacao={projecao?.mesesAtePagar ?? null}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Comparativo mensal</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Últimos 12 meses, sempre — independente do período escolhido acima — pra comparar um ofensor com o outro,
            mês a mês, e ver se está melhorando ou piorando.
          </p>
        </div>
        <GraficoComparativoMensal series={tendenciaComparativa} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">Orçamento por categoria</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Defina um limite mensal por categoria e acompanhe quanto já foi usado.
        </p>

        {orcamentos.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {orcamentos.map((o) => {
              const usado = usoPorCategoria.get(o.categoriaId) ?? 0;
              const pct = Math.min(100, Math.round((usado / o.limiteMensalCentavos) * 100));
              return (
                <div key={o.id} className="glass-card rounded-2xl p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium text-foreground">{o.categoria.nome}</span>
                    <form action={removerOrcamento.bind(null, o.id)}>
                      <button type="submit" className="text-xs text-muted-foreground/70 hover:text-debt">
                        remover
                      </button>
                    </form>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${pct >= 100 ? "bg-debt" : "bg-gold"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatarBRL(usado)} de {formatarBRL(o.limiteMensalCentavos)} usados este mês
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <form
          action={definirOrcamento}
          className="mt-4 flex flex-wrap items-end gap-3 glass-card rounded-2xl p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Categoria</label>
            <select name="categoriaId" required className="w-56 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground">
              <option value="">selecione…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? `— ${c.nome}` : c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Limite mensal (R$)</label>
            <input
              name="limite"
              type="text"
              inputMode="decimal"
              required
              className="w-32 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
            />
          </div>
          <Button type="submit">Salvar</Button>
        </form>
      </section>
    </div>
  );
}
