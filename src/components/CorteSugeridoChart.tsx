import { formatarBRL } from "@/lib/money";
import type { CorteSugerido } from "@/app/resumo/ia/actions";

// Paleta categórica fixa (definida em globals.css) — mesma usada em
// src/app/ofensores/GraficoComparativoMensal.tsx.
const CORES_CATEGORICAS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

// Barra horizontal (não vertical) de propósito: a sheet onde isso
// aparece é estreita (max-w-sm), e uma lista de barras horizontais com
// o valor exato ao lado cabe melhor que um gráfico de coluna nesse
// espaço — sempre com o valor em R$ visível, nunca só a forma da barra.
export function CorteSugeridoChart({ cortes }: { cortes: CorteSugerido[] }) {
  if (cortes.length === 0) {
    return <p className="text-sm text-muted-foreground">A IA não sugeriu nenhum corte com valor específico dessa vez.</p>;
  }

  const ordenados = [...cortes].sort((a, b) => b.valorLiberadoReais - a.valorLiberadoReais);
  const maiorValor = Math.max(...ordenados.map((c) => c.valorLiberadoReais), 0.01);
  const totalCentavos = ordenados.reduce((soma, c) => soma + Math.round(c.valorLiberadoReais * 100), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {ordenados.map((c, i) => {
          const pct = Math.max((c.valorLiberadoReais / maiorValor) * 100, 3);
          return (
            <div key={c.categoria} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium text-foreground">{c.categoria}</span>
                <span className="num shrink-0 text-muted-foreground">
                  {formatarBRL(Math.round(c.valorLiberadoReais * 100))}/mês
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: CORES_CATEGORICAS[i % CORES_CATEGORICAS.length] }}
                />
              </div>
              {c.justificativa && <p className="text-[11px] text-muted-foreground/70">{c.justificativa}</p>}
            </div>
          );
        })}
      </div>
      <div className="flex items-baseline justify-between border-t border-border pt-2 text-sm">
        <span className="font-medium text-foreground">Total liberado por mês</span>
        <span className="num font-semibold text-liquidity">{formatarBRL(totalCentavos)}</span>
      </div>
    </div>
  );
}
