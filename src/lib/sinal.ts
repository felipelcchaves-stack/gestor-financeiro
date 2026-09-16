// Sinal de rota — determinístico, sem IA nenhuma (é matemática, não
// opinião). Responde "estou indo bem?" em uma palavra + uma frase, pra ser
// lido em 2 segundos na tela inicial.

import type { Configuracao, Meta, Passivo } from "@/generated/prisma";
import { calcularProgressoMeta } from "@/lib/metrics";
import { formatarBRL } from "@/lib/money";
import type { Acao } from "@/lib/proximaAcao";

export type NivelSinal = "VERDE" | "AMARELO" | "VERMELHO";

export type Sinal = {
  nivel: NivelSinal;
  titulo: string;
  mensagem: string;
};

const LIMITE_RITMO_INVIAVEL = 1.5;

export function calcularSinal(input: {
  metasAtivas: (Meta & { passivosAlvo: { passivo: Passivo }[]; alocacoes: { valorCentavos: number }[] })[];
  configuracao: Configuracao | null;
  proximasAcoes: Acao[];
  snapshots?: { mesReferencia: string; patrimonioLiquidoCentavos: number }[];
  margemLivre?: { margemLivreCentavos: number };
  hoje?: Date;
}): Sinal {
  const { metasAtivas, configuracao, proximasAcoes, snapshots = [], margemLivre, hoje = new Date() } = input;
  const aporte = configuracao?.aporteMensalExtraCentavos ?? null;

  for (const meta of metasAtivas) {
    const progresso = calcularProgressoMeta(
      meta,
      meta.passivosAlvo.map((mp) => mp.passivo),
      meta.alocacoes,
      hoje
    );

    if (progresso.mesesRestantes <= 0 && progresso.valorFaltanteCentavos > 0) {
      return {
        nivel: "VERMELHO",
        titulo: "Fora da rota",
        mensagem: `A meta "${meta.nome}" já passou da data-alvo e ainda falta ${formatarBRL(progresso.valorFaltanteCentavos)}.`,
      };
    }

    if (aporte != null && progresso.ritmoNecessarioCentavos != null && progresso.ritmoNecessarioCentavos > aporte * LIMITE_RITMO_INVIAVEL) {
      return {
        nivel: "VERMELHO",
        titulo: "Fora da rota",
        mensagem: `No aporte atual, a meta "${meta.nome}" não bate a data-alvo — precisaria de bem mais por mês do que o combinado.`,
      };
    }
  }

  if (margemLivre != null && margemLivre.margemLivreCentavos <= 0) {
    return {
      nivel: "VERMELHO",
      titulo: "Fora da rota",
      mensagem: `Sua margem livre mensal está ${formatarBRL(margemLivre.margemLivreCentavos)} — o mesmo padrão de zero ou negativo que originou a crise atual. Vale rever gastos ou o aporte antes de seguir.`,
    };
  }

  const temPendenciaEstrutural = proximasAcoes.some((a) => a.tipo === "tarefa");
  if (temPendenciaEstrutural) {
    return {
      nivel: "AMARELO",
      titulo: "Atenção",
      mensagem: "Ainda falta 1 ou mais informações pra dar certeza se você está no caminho certo — veja abaixo.",
    };
  }

  if (pioraNosUltimosMeses(snapshots)) {
    return {
      nivel: "AMARELO",
      titulo: "Atenção",
      mensagem: "Seu patrimônio líquido piorou nos últimos meses registrados — vale entender o que mudou antes de seguir.",
    };
  }

  return {
    nivel: "VERDE",
    titulo: "No caminho",
    mensagem: "Seus dados estão completos e o ritmo necessário cabe no aporte que você definiu.",
  };
}

function pioraNosUltimosMeses(snapshots: { mesReferencia: string; patrimonioLiquidoCentavos: number }[]): boolean {
  if (snapshots.length < 2) return false;

  const ordenados = [...snapshots].sort((a, b) => a.mesReferencia.localeCompare(b.mesReferencia));
  const ultimos = ordenados.slice(-3);

  for (let i = 1; i < ultimos.length; i++) {
    if (ultimos[i].patrimonioLiquidoCentavos >= ultimos[i - 1].patrimonioLiquidoCentavos) return false;
  }
  return true;
}
