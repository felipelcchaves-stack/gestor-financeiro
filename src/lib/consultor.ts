// Consultor pessoal (motor de regras, sem IA generativa nem custo por uso):
// olha suas dívidas, seu fôlego de caixa e sua reserva de emergência, e
// devolve um veredito claro por dívida — "quitar" ou "manter mínimo e
// investir a sobra" — mais os alertas que precisam ser resolvidos antes de
// qualquer um desses vereditos fazer sentido na prática.

import type { Passivo } from "@/generated/prisma";

const MESES_RESERVA_ALVO = 3;

export type VeredictoPassivo = {
  passivoId: string;
  nome: string;
  taxaJurosPct: number | null;
  saldoCentavos: number | null;
  veredicto: "QUITAR_PRIORITARIO" | "MANTER_MINIMO" | "SEM_DADO";
  motivo: string;
};

export type ResultadoConsultor = {
  reservaAlvoCentavos: number;
  reservaAtualCentavos: number;
  reservaOk: boolean;
  temFolego: boolean;
  veredictos: VeredictoPassivo[];
};

export function calcularConsultor(input: {
  passivosAtivos: Pick<Passivo, "id" | "nome" | "taxaJurosPct" | "valorQuitacaoCentavos">[];
  saldoLiquidoContasCentavos: number;
  despesasRecorrentesMensaisCentavos: number;
  margemLivreCentavos: number;
  taxaReferenciaMensalPct: number | null;
}): ResultadoConsultor {
  const { passivosAtivos, saldoLiquidoContasCentavos, despesasRecorrentesMensaisCentavos, margemLivreCentavos, taxaReferenciaMensalPct } =
    input;

  const reservaAlvoCentavos = despesasRecorrentesMensaisCentavos * MESES_RESERVA_ALVO;
  const reservaOk = reservaAlvoCentavos === 0 || saldoLiquidoContasCentavos >= reservaAlvoCentavos;
  const temFolego = margemLivreCentavos > 0;

  const referencia = taxaReferenciaMensalPct ?? 0;

  const veredictos: VeredictoPassivo[] = passivosAtivos
    .map((p) => {
      if (p.taxaJurosPct == null) {
        return {
          passivoId: p.id,
          nome: p.nome,
          taxaJurosPct: null,
          saldoCentavos: p.valorQuitacaoCentavos,
          veredicto: "SEM_DADO" as const,
          motivo: "Taxa de juro não documentada — não dá pra comparar com o rendimento de referência.",
        };
      }

      if (p.taxaJurosPct <= referencia) {
        return {
          passivoId: p.id,
          nome: p.nome,
          taxaJurosPct: p.taxaJurosPct,
          saldoCentavos: p.valorQuitacaoCentavos,
          veredicto: "MANTER_MINIMO" as const,
          motivo: `Juro de ${p.taxaJurosPct}% a.m. é menor ou igual à referência (${referencia}% a.m.) — matematicamente, vale mais pagar só o mínimo e deixar a sobra rendendo.`,
        };
      }

      return {
        passivoId: p.id,
        nome: p.nome,
        taxaJurosPct: p.taxaJurosPct,
        saldoCentavos: p.valorQuitacaoCentavos,
        veredicto: "QUITAR_PRIORITARIO" as const,
        motivo: `Juro de ${p.taxaJurosPct}% a.m. é maior que a referência (${referencia}% a.m.) — cada mês que essa dívida existe custa mais do que qualquer investimento renderia.`,
      };
    })
    .sort((a, b) => (b.taxaJurosPct ?? -1) - (a.taxaJurosPct ?? -1));

  return { reservaAlvoCentavos, reservaAtualCentavos: saldoLiquidoContasCentavos, reservaOk, temFolego, veredictos };
}

export type DestinoEntradaPontual = {
  destino: "RESERVA" | "PASSIVO" | "INVESTIR";
  valorCentavos: number;
  detalhe: string;
};

// Mesma cascata de prioridade do veredito mensal, aplicada a um valor avulso
// (13º, restituição, bônus) em vez do aporte recorrente: primeiro completa a
// reserva de emergência que estiver faltando, depois ataca as dívidas
// QUITAR_PRIORITARIO (já vêm ordenadas por taxa decrescente) até o saldo de
// cada uma, e só sobra pra "investir" o que passar de tudo isso.
export function alocarEntradaPontual(valorCentavos: number, resultado: ResultadoConsultor): DestinoEntradaPontual[] {
  const alocacoes: DestinoEntradaPontual[] = [];
  let restante = valorCentavos;

  if (restante > 0 && !resultado.reservaOk) {
    const faltaReserva = resultado.reservaAlvoCentavos - resultado.reservaAtualCentavos;
    const aplicar = Math.min(restante, faltaReserva);
    if (aplicar > 0) {
      alocacoes.push({ destino: "RESERVA", valorCentavos: aplicar, detalhe: "Completar reserva de emergência" });
      restante -= aplicar;
    }
  }

  const prioritarios = resultado.veredictos.filter(
    (v): v is VeredictoPassivo & { saldoCentavos: number } => v.veredicto === "QUITAR_PRIORITARIO" && v.saldoCentavos != null && v.saldoCentavos > 0
  );

  for (const p of prioritarios) {
    if (restante <= 0) break;
    const aplicar = Math.min(restante, p.saldoCentavos);
    alocacoes.push({ destino: "PASSIVO", valorCentavos: aplicar, detalhe: p.nome });
    restante -= aplicar;
  }

  if (restante > 0) {
    alocacoes.push({
      destino: "INVESTIR",
      valorCentavos: restante,
      detalhe:
        prioritarios.length === 0
          ? "Nenhuma dívida prioritária no momento — pode investir tudo"
          : "Sobra depois de reserva e dívidas prioritárias",
    });
  }

  return alocacoes;
}

export type SimulacaoQuitacaoAVista = {
  valorFaceCentavos: number;
  valorAVistaCentavos: number;
  economiaCentavos: number;
  recomendacao: string;
};

// Desconto por quitação à vista: alguns credores oferecem abater um % do
// saldo pra quitar tudo de uma vez. Mostra a economia literal do desconto e
// usa os mesmos sinais de segurança do veredito (reserva/fôlego) — não
// projeta juro futuro evitado, porque o sistema não tem prazo/amortização
// documentados o suficiente pra isso com precisão.
export function simularQuitacaoAVista(
  valorFaceCentavos: number,
  descontoPct: number,
  resultado: Pick<ResultadoConsultor, "reservaOk" | "temFolego">
): SimulacaoQuitacaoAVista {
  const valorAVistaCentavos = Math.round(valorFaceCentavos * (1 - descontoPct / 100));
  const economiaCentavos = valorFaceCentavos - valorAVistaCentavos;

  let recomendacao: string;
  if (!resultado.reservaOk) {
    recomendacao = "Sua reserva de emergência ainda não está completa — não vale usar essa reserva pra pagar à vista, mesmo com desconto.";
  } else if (!resultado.temFolego) {
    recomendacao = "Sua margem livre está zerada ou negativa — não há sobra de caixa segura pra bancar isso agora.";
  } else {
    recomendacao = "Reserva e fôlego de caixa OK — se o dinheiro estiver disponível sem comprometer os dois, o desconto costuma valer a pena.";
  }

  return { valorFaceCentavos, valorAVistaCentavos, economiaCentavos, recomendacao };
}
