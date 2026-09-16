import Link from "next/link";
import type { SerieMensal } from "@/lib/ofensores";
import { formatarBRL } from "@/lib/money";

// Paleta categórica fixa (definida em globals.css, validada com o script de
// dataviz — não reordenar sem revalidar). "Outros" usa a cor neutra de
// texto secundário, de propósito: não é uma entidade real, é um balde.
const CORES_CATEGORICAS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const COR_OUTROS = "var(--muted-foreground)";
// "Sem vínculo"/"Sem categoria" não são um credor/categoria de verdade — são
// dado faltando. Cor de alerta (não categórica, não neutra) pra nunca passar
// despercebido, principalmente porque costuma ser o maior valor do gráfico.
const COR_PENDENTE = "var(--gold)";

function ehPendente(serie: SerieMensal): boolean {
  return serie.id === "sem-vinculo" || serie.id === "sem-categoria";
}

function corDaSerie(serie: SerieMensal, indice: number): string {
  if (ehPendente(serie)) return COR_PENDENTE;
  if (serie.id === "outros") return COR_OUTROS;
  return CORES_CATEGORICAS[indice % CORES_CATEGORICAS.length];
}

function linkResolverDe(serie: SerieMensal): string | null {
  if (serie.id === "sem-vinculo") return "/transacoes?semVinculo=1";
  if (serie.id === "sem-categoria") return "/transacoes?semCategoria=1";
  return null;
}

function nomeMes(mes: string) {
  const [ano, mesNum] = mes.split("-").map(Number);
  return new Date(ano, mesNum - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

// Caminho de uma barra com topo arredondado e base quadrada (encostada na
// linha de base) — regra do skill de dataviz: "4px rounded data-end, square
// at the baseline". Um <rect> com rx arredondaria os 4 cantos; por isso o
// path manual.
function pathBarra(x: number, yTopo: number, largura: number, altura: number, raio: number): string {
  if (altura <= 0) return "";
  const r = Math.min(raio, largura / 2, altura);
  const yBase = yTopo + altura;
  return [
    `M ${x} ${yBase}`,
    `L ${x} ${yTopo + r}`,
    `Q ${x} ${yTopo} ${x + r} ${yTopo}`,
    `L ${x + largura - r} ${yTopo}`,
    `Q ${x + largura} ${yTopo} ${x + largura} ${yTopo + r}`,
    `L ${x + largura} ${yBase}`,
    "Z",
  ].join(" ");
}

// Barras agrupadas por mês (uma por série, lado a lado) — pra comparar um
// ofensor com o outro mês a mês, coisa que uma linha (feita pra mostrar
// trajetória/projeção, não comparação lado a lado) não entrega. Legenda
// sempre visível com o total do período por série, e uma tabela completa
// logo abaixo — sem esconder valor nenhum atrás de hover ou de "ver
// valores": aqui a exigência é poder ler o número, não só ver a forma.
export function GraficoComparativoMensal({ series }: { series: SerieMensal[] }) {
  if (series.length === 0 || series.every((s) => s.porMes.every((p) => p.totalCentavos === 0))) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <p className="text-sm text-muted-foreground">Sem dados suficientes pra montar o comparativo ainda.</p>
      </div>
    );
  }

  const meses = series.reduce((a, b) => (a.porMes.length > b.porMes.length ? a : b), series[0]).porMes.map((p) => p.mes);

  const ALTURA = 200;
  const MARGEM_ESQ = 56;
  const MARGEM_BASE = 28;
  const LARGURA_BARRA = 14;
  const GAP_BARRA = 2;
  const GAP_CLUSTER = 18;
  const larguraCluster = series.length * (LARGURA_BARRA + GAP_BARRA) - GAP_BARRA;
  const largura = MARGEM_ESQ + meses.length * (larguraCluster + GAP_CLUSTER);

  const maiorValor = Math.max(1, ...series.flatMap((s) => s.porMes.map((p) => p.totalCentavos)));
  const escalaAltura = (valor: number) => (valor / maiorValor) * (ALTURA - MARGEM_BASE);

  const ticks = [0, 0.5, 1].map((f) => Math.round((maiorValor * f) / 100) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto glass-card rounded-2xl p-4">
        <svg
          viewBox={`0 0 ${largura + 12} ${ALTURA + 24}`}
          className="w-full"
          style={{ minWidth: `${Math.min(largura + 12, 1100)}px` }}
          role="img"
          aria-label="Comparativo de gasto mensal entre os principais ofensores, últimos 12 meses"
        >
          {ticks.map((valor, i) => {
            const y = ALTURA - MARGEM_BASE - escalaAltura(valor);
            return (
              <g key={i}>
                <line x1={MARGEM_ESQ} y1={y} x2={largura} y2={y} stroke="var(--border)" strokeWidth={1} />
                <text x={MARGEM_ESQ - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">
                  {formatarBRL(valor).replace(",00", "")}
                </text>
              </g>
            );
          })}

          {meses.map((mes, mesIdx) => {
            const xCluster = MARGEM_ESQ + mesIdx * (larguraCluster + GAP_CLUSTER);
            return (
              <g key={mes}>
                {series.map((serie, serieIdx) => {
                  const ponto = serie.porMes[mesIdx];
                  const valor = ponto?.totalCentavos ?? 0;
                  const alturaBarra = escalaAltura(valor);
                  const x = xCluster + serieIdx * (LARGURA_BARRA + GAP_BARRA);
                  const yTopo = ALTURA - MARGEM_BASE - alturaBarra;
                  return (
                    <path key={serie.id} d={pathBarra(x, yTopo, LARGURA_BARRA, alturaBarra, 4)} fill={corDaSerie(serie, serieIdx)}>
                      <title>{`${serie.nome} — ${nomeMes(mes)} — ${formatarBRL(valor)}`}</title>
                    </path>
                  );
                })}
                <line
                  x1={xCluster}
                  y1={ALTURA - MARGEM_BASE}
                  x2={xCluster + larguraCluster}
                  y2={ALTURA - MARGEM_BASE}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text
                  x={xCluster + larguraCluster / 2}
                  y={ALTURA + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--muted-foreground)"
                >
                  {nomeMes(mes)}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3">
          {series.map((serie, i) => {
            const total = serie.porMes.reduce((acc, p) => acc + p.totalCentavos, 0);
            const link = linkResolverDe(serie);
            return (
              <div key={serie.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: corDaSerie(serie, i) }} />
                <span className={ehPendente(serie) ? "text-gold" : "text-foreground"}>{serie.nome}</span>
                <span className="num">{formatarBRL(total)}</span>
                {link && (
                  <Link href={link} className="text-gold underline underline-offset-4">
                    resolver
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="bg-surface-2 text-left uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Ofensor</th>
              {meses.map((mes) => (
                <th key={mes} className="px-2 py-2 text-right font-medium">
                  {nomeMes(mes)}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {series.map((serie, i) => {
              const total = serie.porMes.reduce((acc, p) => acc + p.totalCentavos, 0);
              return (
                <tr key={serie.id}>
                  <td className="px-3 py-2">
                    <span className={`flex items-center gap-1.5 ${ehPendente(serie) ? "text-gold" : "text-foreground"}`}>
                      <span className="inline-block size-2 rounded-sm" style={{ backgroundColor: corDaSerie(serie, i) }} />
                      {serie.nome}
                    </span>
                  </td>
                  {serie.porMes.map((p) => (
                    <td key={p.mes} className="num px-2 py-2 text-right text-muted-foreground">
                      {formatarBRL(p.totalCentavos)}
                    </td>
                  ))}
                  <td className="num px-3 py-2 text-right font-medium text-foreground">{formatarBRL(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
