import type { PontoSaldo } from "@/lib/ofensores";
import { GraficoLinhaTemporal, type SerieLinhaTemporal } from "@/components/GraficoLinhaTemporal";

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

export function TrajetoriaCredorChart({
  nome,
  real,
  projetado,
  mesQuitacao,
}: {
  nome: string;
  real: PontoSaldo[];
  projetado: number[] | null;
  mesQuitacao: number | null;
}) {
  if (real.length === 0) return null;

  const hoje = new Date();
  const pontosReais = real.map((p) => ({ label: formatarData(p.data), valorCentavos: p.valorCentavos, tracejado: false }));

  const pontosProjetados = (projetado ?? []).map((saldo, i) => ({
    label: `daqui a ${i + 1} ${i === 0 ? "mês" : "meses"}`,
    valorCentavos: saldo,
    tracejado: true,
  }));

  // Ponto "hoje" — repete o último valor real como âncora do trecho
  // tracejado, pra linha ficar contínua em vez de dar um salto visual.
  const pontoHoje =
    pontosProjetados.length > 0
      ? [{ label: `hoje (${formatarData(hoje.toISOString())})`, valorCentavos: real[real.length - 1].valorCentavos, tracejado: false }]
      : [];

  const series: SerieLinhaTemporal[] = [
    {
      id: "saldo",
      nome:
        mesQuitacao != null
          ? `${nome} — quita em ${mesQuitacao} ${mesQuitacao === 1 ? "mês" : "meses"}`
          : nome,
      cor: "var(--debt)",
      pontos: [...pontosReais, ...pontoHoje, ...pontosProjetados],
    },
  ];

  return (
    <GraficoLinhaTemporal
      series={series}
      tituloEixo="Saldo devedor — real até hoje, projetado dali em diante"
      ariaLabel={`Trajetória de saldo devedor de ${nome}, real e projetada`}
      mostrarTotalPeriodo={false}
    />
  );
}
