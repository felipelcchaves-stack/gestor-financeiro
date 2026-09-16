import { formatarBRL } from "@/lib/money";

export type PontoLinhaTemporal = { label: string; valorCentavos: number; tracejado?: boolean };
export type SerieLinhaTemporal = { id: string; nome: string; cor: string; pontos: PontoLinhaTemporal[] };

// Gráfico de linha genérico (sem lib externa, só SVG) reaproveitado pelos
// gráficos de trajetória do app (otimização, ofensores) — todo ponto tem o
// valor exposto de verdade, não só o desenho da curva: um "title" nativo
// do SVG mostra "label — R$valor" ao passar o mouse, os pontos-chave (1º,
// "hoje"/início da projeção e último) ganham o valor escrito do lado, e
// uma tabela dobrável por baixo lista todo mês → valor, passado e futuro
// juntos na mesma lista.
export function GraficoLinhaTemporal({
  series,
  tituloEixo,
  ariaLabel,
  semDados,
  mostrarTotalPeriodo = true,
}: {
  series: SerieLinhaTemporal[];
  tituloEixo: string;
  ariaLabel: string;
  semDados?: string;
  // Somar os pontos só faz sentido pra gráfico de fluxo (gasto por mês) —
  // pra gráfico de saldo (uma foto do quanto falta em cada momento), somar
  // os pontos não representa nada real. Quem chama com dado de saldo
  // desliga isso e já embute o resumo que importa (ex: "quita no mês N")
  // no próprio `nome` da série.
  mostrarTotalPeriodo?: boolean;
}) {
  const largura = 640;
  const altura = 220;
  const margem = 28;

  const maiorSerie = series.reduce((a, b) => (a.pontos.length > b.pontos.length ? a : b), series[0]);
  const totalPontos = maiorSerie?.pontos.length ?? 0;

  if (totalPontos === 0) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <p className="text-sm text-muted-foreground">{semDados ?? "Sem dados suficientes pra montar esse gráfico ainda."}</p>
      </div>
    );
  }

  const indiceMax = Math.max(1, totalPontos - 1);
  const maiorValor = Math.max(1, ...series.flatMap((s) => s.pontos.map((p) => p.valorCentavos)));

  const escalaX = (i: number) => margem + (i / indiceMax) * (largura - margem * 2);
  const escalaY = (valor: number) => altura - margem - (valor / maiorValor) * (altura - margem * 2);

  return (
    <div className="overflow-x-auto glass-card rounded-2xl p-4">
      <p className="text-xs font-medium text-muted-foreground">{tituloEixo}</p>
      <svg viewBox={`0 0 ${largura} ${altura + 24}`} className="mt-2 w-full min-w-[480px]" role="img" aria-label={ariaLabel}>
        <line x1={margem} y1={altura - margem} x2={largura - margem} y2={altura - margem} stroke="var(--border)" strokeDasharray="4 4" />

        {series.map((serie) => (
          <g key={serie.id}>
            {serie.pontos.slice(1).map((ponto, i) => {
              const anterior = serie.pontos[i];
              const tracejado = Boolean(ponto.tracejado || anterior.tracejado);
              return (
                <line
                  key={i}
                  x1={escalaX(i)}
                  y1={escalaY(anterior.valorCentavos)}
                  x2={escalaX(i + 1)}
                  y2={escalaY(ponto.valorCentavos)}
                  stroke={serie.cor}
                  strokeWidth={2}
                  strokeDasharray={tracejado ? "5 4" : undefined}
                />
              );
            })}
            {serie.pontos.map((ponto, i) => (
              <circle key={i} cx={escalaX(i)} cy={escalaY(ponto.valorCentavos)} r={2.5} fill={serie.cor}>
                <title>{`${ponto.label} — ${formatarBRL(ponto.valorCentavos)}${ponto.tracejado ? " (projetado)" : ""}`}</title>
              </circle>
            ))}
          </g>
        ))}

        {maiorSerie && (
          <>
            <text x={escalaX(0)} y={altura + 16} textAnchor="start" fontSize={10} fill="var(--muted-foreground)">
              {maiorSerie.pontos[0].label} · {formatarBRL(maiorSerie.pontos[0].valorCentavos)}
            </text>
            {maiorSerie.pontos.length > 1 && (
              <text
                x={escalaX(maiorSerie.pontos.length - 1)}
                y={altura + 16}
                textAnchor="end"
                fontSize={10}
                fill="var(--muted-foreground)"
              >
                {maiorSerie.pontos[maiorSerie.pontos.length - 1].label} ·{" "}
                {formatarBRL(maiorSerie.pontos[maiorSerie.pontos.length - 1].valorCentavos)}
              </text>
            )}
          </>
        )}
      </svg>

      <div className="mt-2 flex flex-col gap-2">
        {series.map((serie) => {
          const total = serie.pontos.reduce((acc, p) => acc + p.valorCentavos, 0);
          const temProjecao = serie.pontos.some((p) => p.tracejado);
          return (
            <div key={serie.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block h-0.5 w-4" style={{ backgroundColor: serie.cor }} />
                {serie.nome}
                {mostrarTotalPeriodo && (
                  <>
                    {" "}
                    — {formatarBRL(total)} no período{temProjecao ? " (inclui projeção)" : ""}
                  </>
                )}
                <details className="ml-1">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground/70 hover:text-foreground">
                    ver valores
                  </summary>
                  <ul className="mt-1 flex flex-col gap-0.5 pl-2 font-mono text-[11px]">
                    {serie.pontos.map((p, i) => (
                      <li key={i} className="flex justify-between gap-4">
                        <span>{p.label}</span>
                        <span>
                          {formatarBRL(p.valorCentavos)}
                          {p.tracejado ? " (projetado)" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
