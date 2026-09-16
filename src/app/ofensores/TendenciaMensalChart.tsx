import type { SerieMensal } from "@/lib/ofensores";
import { GraficoLinhaTemporal, type SerieLinhaTemporal } from "@/components/GraficoLinhaTemporal";

const CORES = ["var(--debt)", "var(--gold)", "var(--liquidity)", "#8b5cf6", "#06b6d4", "var(--muted-foreground)"];

function nomeMes(mes: string) {
  const [ano, mesNum] = mes.split("-").map(Number);
  return new Date(ano, mesNum - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function TendenciaMensalChart({ series }: { series: SerieMensal[] }) {
  const seriesConvertidas: SerieLinhaTemporal[] = series.map((serie, i) => ({
    id: serie.id,
    nome: serie.nome,
    cor: CORES[i % CORES.length],
    pontos: serie.porMes.map((p) => ({ label: nomeMes(p.mes), valorCentavos: p.totalCentavos, tracejado: p.projetado })),
  }));

  return (
    <GraficoLinhaTemporal
      series={seriesConvertidas}
      tituloEixo="Gasto por mês"
      ariaLabel="Tendência mensal de gasto por credor/categoria, com projeção futura quando disponível"
      semDados="Sem dados suficientes pra montar a tendência mensal ainda."
    />
  );
}
