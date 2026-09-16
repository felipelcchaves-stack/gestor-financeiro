const CORES: Record<string, string> = {
  SAUDAVEL: "var(--liquidity)",
  ATENCAO: "var(--gold)",
  CRITICO: "var(--debt)",
};

const ZONAS = [
  { de: 0, ate: 0.5, cor: "var(--debt)", label: "0–49 Crítico" },
  { de: 0.5, ate: 0.8, cor: "var(--gold)", label: "50–79 Atenção" },
  { de: 0.8, ate: 1, cor: "var(--liquidity)", label: "80–100 Saudável" },
];

function ponto(cx: number, cy: number, r: number, p: number) {
  const angulo = Math.PI * (1 - p);
  return { x: cx + r * Math.cos(angulo), y: cy - r * Math.sin(angulo) };
}

function arco(cx: number, cy: number, r: number, de: number, ate: number) {
  const inicio = ponto(cx, cy, r, de);
  const fim = ponto(cx, cy, r, ate);
  return `M ${inicio.x} ${inicio.y} A ${r} ${r} 0 0 1 ${fim.x} ${fim.y}`;
}

export function ScoreGauge({ pontos, faixa }: { pontos: number; faixa: string }) {
  const cx = 100;
  const cy = 100;
  const r = 80;
  const strokeWidth = 14;

  const arcoCompleto = Math.PI * r;
  const percentual = Math.max(0, Math.min(100, pontos)) / 100;
  const cor = CORES[faixa] ?? "var(--muted-foreground)";

  const caminhoCompleto = arco(cx, cy, r, 0, 1);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 200 112"
        className="w-40 shrink-0"
        role="img"
        aria-label={`Score de saúde financeira: ${pontos} de 100`}
      >
        {ZONAS.map((z) => (
          <path
            key={z.label}
            d={arco(cx, cy, r, z.de, z.ate)}
            fill="none"
            stroke={z.cor}
            strokeWidth={strokeWidth}
            strokeOpacity={0.22}
          />
        ))}
        <path
          d={caminhoCompleto}
          fill="none"
          stroke={cor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcoCompleto}
          strokeDashoffset={arcoCompleto * (1 - percentual)}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={34} fontWeight={600} fill={cor} className="num">
          {pontos}
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {ZONAS.map((z) => (
          <span key={z.label} className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: z.cor }} />
            {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}
