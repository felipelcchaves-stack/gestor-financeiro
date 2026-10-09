export function formatarMesLabel(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const data = new Date(ano, mes - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(data);
}

export function Termometro({
  snapshots,
}: {
  snapshots: { mesReferencia: string; patrimonioLiquidoCentavos: number; confiabilidade?: string | null }[];
}) {
  if (snapshots.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Ainda não há histórico suficiente pra desenhar a tendência — registre pelo menos mais um
        mês pra ver o termômetro.
      </p>
    );
  }

  const largura = 640;
  const altura = 140;
  const margem = 24;

  const valores = snapshots.map((s) => s.patrimonioLiquidoCentavos);
  const min = Math.min(0, ...valores);
  const max = Math.max(0, ...valores);

  const escalaY = (v: number) => {
    if (max === min) return altura / 2;
    return altura - margem - ((v - min) / (max - min)) * (altura - margem * 2);
  };
  const escalaX = (i: number) =>
    snapshots.length === 1 ? largura / 2 : margem + (i * (largura - margem * 2)) / (snapshots.length - 1);

  const pontos = snapshots.map((s, i) => `${escalaX(i)},${escalaY(s.patrimonioLiquidoCentavos)}`).join(" ");
  const yZero = escalaY(0);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${largura} ${altura + 24}`} className="w-full min-w-[480px]" role="img" aria-label="Tendência de patrimônio líquido">
        <line x1={margem} y1={yZero} x2={largura - margem} y2={yZero} stroke="var(--border)" strokeDasharray="4 4" />
        <polyline points={pontos} fill="none" stroke="var(--gold)" strokeWidth={2} />
        {snapshots.map((s, i) => (
          <g key={s.mesReferencia}>
            <circle
              cx={escalaX(i)}
              cy={escalaY(s.patrimonioLiquidoCentavos)}
              r={4}
              fill={s.confiabilidade === "ESTIMADO" ? "none" : s.patrimonioLiquidoCentavos >= 0 ? "var(--liquidity)" : "var(--debt)"}
              stroke={s.patrimonioLiquidoCentavos >= 0 ? "var(--liquidity)" : "var(--debt)"}
              strokeWidth={s.confiabilidade === "ESTIMADO" ? 2 : 0}
            >
              <title>{s.confiabilidade === "ESTIMADO" ? "Lembrado de memória, não calculado" : "Calculado dos dados documentados"}</title>
            </circle>
            <text x={escalaX(i)} y={altura + 16} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
              {formatarMesLabel(s.mesReferencia)}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        Linha tracejada = patrimônio zero. Acima dela: saindo do buraco. Abaixo: ainda negativo.
      </p>
    </div>
  );
}
