import type { PontoEvolucaoMensal } from "@/lib/ofensores";
import { formatarBRL } from "@/lib/money";

// Cores fixas e semânticas (entrada = liquidez, despesa = dívida) —
// diferente da paleta categórica genérica usada em gráficos com N
// séries variáveis (ex: GraficoComparativoMensal.tsx), aqui as duas
// séries são sempre as mesmas duas coisas, então a cor carrega
// significado.
const COR_ENTRADA = "var(--liquidity)";
const COR_DESPESA = "var(--debt)";

function nomeMes(mes: string, projetado = false) {
  const [ano, mesNum] = mes.split("-").map(Number);
  const base = new Date(ano, mesNum - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  return projetado ? `${base} (proj.)` : base;
}

// Mesma regra de dataviz já usada em GraficoComparativoMensal.tsx:
// barra com topo arredondado, base quadrada encostada na linha de
// base — um <rect> arredondaria os 4 cantos, por isso o path manual.
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

// Entrada x despesa real, mês a mês — "estou melhorando ou piorando"
// visível de cara, sem abrir outra tela. Sempre junto de uma tabela
// exata: a barra mostra a forma, a tabela mostra o número certo.
export function EvolucaoMensalChart({ pontos }: { pontos: PontoEvolucaoMensal[] }) {
  if (pontos.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <p className="text-sm text-muted-foreground">Sem transação importada ainda pra montar a evolução mensal.</p>
      </div>
    );
  }

  const ALTURA = 200;
  const MARGEM_ESQ = 56;
  const MARGEM_BASE = 28;
  const LARGURA_BARRA = 14;
  const GAP_BARRA = 2;
  const GAP_CLUSTER = 18;
  const larguraCluster = 2 * (LARGURA_BARRA + GAP_BARRA) - GAP_BARRA;
  const largura = MARGEM_ESQ + pontos.length * (larguraCluster + GAP_CLUSTER);

  const maiorValor = Math.max(1, ...pontos.flatMap((p) => [p.entradasCentavos, p.despesasCentavos]));
  const escalaAltura = (valor: number) => (valor / maiorValor) * (ALTURA - MARGEM_BASE);
  const ticks = [0, 0.5, 1].map((f) => Math.round((maiorValor * f) / 100) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto glass-card rounded-2xl p-4">
        <svg
          viewBox={`0 0 ${largura + 12} ${ALTURA + 32}`}
          className="w-full"
          style={{ minWidth: `${Math.min(largura + 12, 1100)}px` }}
          role="img"
          aria-label="Entradas e despesas reais por mês, desde o início do histórico importado"
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

          {pontos.map((ponto, i) => {
            const xCluster = MARGEM_ESQ + i * (larguraCluster + GAP_CLUSTER);
            const alturaEntrada = escalaAltura(ponto.entradasCentavos);
            const alturaDespesa = escalaAltura(ponto.despesasCentavos);
            const xEntrada = xCluster;
            const xDespesa = xCluster + LARGURA_BARRA + GAP_BARRA;
            return (
              <g key={ponto.mes}>
                <path
                  d={pathBarra(xEntrada, ALTURA - MARGEM_BASE - alturaEntrada, LARGURA_BARRA, alturaEntrada, 4)}
                  fill={COR_ENTRADA}
                  fillOpacity={ponto.projetado ? 0.5 : 1}
                  stroke={ponto.projetado ? COR_ENTRADA : "none"}
                  strokeWidth={ponto.projetado ? 1 : 0}
                  strokeDasharray={ponto.projetado ? "3 2" : undefined}
                >
                  <title>{`${ponto.projetado ? "Projeção de entradas" : "Entradas"} — ${nomeMes(ponto.mes, ponto.projetado)} — ${formatarBRL(ponto.entradasCentavos)}`}</title>
                </path>
                <path
                  d={pathBarra(xDespesa, ALTURA - MARGEM_BASE - alturaDespesa, LARGURA_BARRA, alturaDespesa, 4)}
                  fill={COR_DESPESA}
                  fillOpacity={ponto.projetado ? 0.5 : 1}
                  stroke={ponto.projetado ? COR_DESPESA : "none"}
                  strokeWidth={ponto.projetado ? 1 : 0}
                  strokeDasharray={ponto.projetado ? "3 2" : undefined}
                >
                  <title>{`${ponto.projetado ? "Projeção de despesas" : "Despesas"} — ${nomeMes(ponto.mes, ponto.projetado)} — ${formatarBRL(ponto.despesasCentavos)}`}</title>
                </path>
                <line
                  x1={xCluster}
                  y1={ALTURA - MARGEM_BASE}
                  x2={xCluster + larguraCluster}
                  y2={ALTURA - MARGEM_BASE}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text x={xCluster + larguraCluster / 2} y={ALTURA + 14} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
                  {ponto.projetado ? (
                    <>
                      <tspan x={xCluster + larguraCluster / 2}>{nomeMes(ponto.mes)}</tspan>
                      <tspan x={xCluster + larguraCluster / 2} dy={10}>
                        (proj.)
                      </tspan>
                    </>
                  ) : (
                    nomeMes(ponto.mes)
                  )}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: COR_ENTRADA }} />
            <span className="text-foreground">Entradas</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: COR_DESPESA }} />
            <span className="text-foreground">Despesas</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px] text-xs">
          <thead className="bg-surface-2 text-left uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Mês</th>
              <th className="px-2 py-2 text-right font-medium">Entradas</th>
              <th className="px-2 py-2 text-right font-medium">Despesas</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pontos.map((p) => {
              const saldo = p.entradasCentavos - p.despesasCentavos;
              return (
                <tr key={p.mes} className={p.projetado ? "italic opacity-70" : undefined}>
                  <td className="px-3 py-2 text-foreground">
                    {nomeMes(p.mes)}
                    {p.projetado && <span className="text-muted-foreground"> (projetado)</span>}
                  </td>
                  <td className="num px-2 py-2 text-right text-liquidity">{formatarBRL(p.entradasCentavos)}</td>
                  <td className="num px-2 py-2 text-right text-debt">{formatarBRL(p.despesasCentavos)}</td>
                  <td className={`num px-3 py-2 text-right font-medium ${saldo >= 0 ? "text-liquidity" : "text-debt"}`}>
                    {formatarBRL(saldo)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
