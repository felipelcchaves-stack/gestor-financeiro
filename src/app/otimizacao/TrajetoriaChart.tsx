import type { ResultadoEstrategia } from "@/lib/otimizacao";
import { GraficoLinhaTemporal, type SerieLinhaTemporal } from "@/components/GraficoLinhaTemporal";

type Linha = { nome: string; resultado: ResultadoEstrategia; cor: string; tracejado?: boolean };

export function TrajetoriaChart({ estrategias }: { estrategias: Linha[] }) {
  const saldoInicial = Math.max(1, ...estrategias.map((e) => e.resultado.trajetoriaSaldoTotalCentavos[0] ?? 0));

  const series: SerieLinhaTemporal[] = estrategias.map((linha) => ({
    id: linha.nome,
    nome: `${linha.nome} — zera no mês ${linha.resultado.mesesTotais}`,
    cor: linha.cor,
    pontos: [
      { label: "mês 0", valorCentavos: linha.resultado.trajetoriaSaldoTotalCentavos[0] ?? saldoInicial, tracejado: linha.tracejado },
      ...linha.resultado.trajetoriaSaldoTotalCentavos.map((saldo, i) => ({
        label: `mês ${i + 1}`,
        valorCentavos: saldo,
        tracejado: linha.tracejado,
      })),
    ],
  }));

  return (
    <GraficoLinhaTemporal
      series={series}
      tituloEixo="Saldo total restante, mês a mês"
      ariaLabel="Projeção de saldo total restante por estratégia"
      mostrarTotalPeriodo={false}
    />
  );
}
