// Alertas de padrão de risco (seção 4.3 do PRD) — sinaliza antes que o
// padrão que gerou a crise se repita, em vez de só aparecer quando o
// extrato já mostrou o estrago.

import { formatarBRL } from "@/lib/money";
import type { CicloFaturaPassivo, Conta, Passivo } from "@/generated/prisma";

export type Alerta = {
  titulo: string;
  mensagem: string;
  tipo?: "CHEQUE_ESPECIAL" | "FATURA_CRESCENDO" | "SEM_META";
  passivoId?: string;
};

const DIAS_PASSIVO_RECENTE = 30;
const LIMITE_ALERTA_SEM_META = 3;

export function calcularAlertas(input: {
  contas: Pick<Conta, "nome" | "saldoAtualCentavos" | "limiteChequeEspecialCentavos" | "carenciaDiasChequeEspecial" | "saldoAtualizadoEm">[];
  passivosComCiclos: (Pick<Passivo, "id" | "nome"> & { ciclosFatura: Pick<CicloFaturaPassivo, "referencia" | "valorCentavos">[] })[];
  passivosRecentesSemMeta: Pick<Passivo, "nome" | "createdAt">[];
  hoje?: Date;
}): Alerta[] {
  const { contas, passivosComCiclos, passivosRecentesSemMeta } = input;
  const alertas: Alerta[] = [];

  for (const conta of contas) {
    if (conta.limiteChequeEspecialCentavos != null && conta.saldoAtualCentavos != null && conta.saldoAtualCentavos < 0) {
      const carencia = conta.carenciaDiasChequeEspecial;
      alertas.push({
        titulo: `Usando o cheque especial da ${conta.nome}`,
        mensagem:
          carencia != null
            ? `Saldo negativo (${formatarBRL(conta.saldoAtualCentavos)}). Fique de olho na janela de ${carencia} dias sem juros — depois dela, isso passa a render juros de cheque especial.`
            : `Saldo negativo (${formatarBRL(conta.saldoAtualCentavos)}) usando o limite do cheque especial.`,
        tipo: "CHEQUE_ESPECIAL",
      });
    }
  }

  for (const passivo of passivosComCiclos) {
    const ordenados = [...passivo.ciclosFatura].sort((a, b) => b.referencia.localeCompare(a.referencia));
    if (ordenados.length >= 2 && ordenados[0].valorCentavos > ordenados[1].valorCentavos) {
      alertas.push({
        titulo: `A fatura de ${passivo.nome} voltou a crescer`,
        mensagem: `${formatarBRL(ordenados[1].valorCentavos)} (${ordenados[1].referencia}) → ${formatarBRL(ordenados[0].valorCentavos)} (${ordenados[0].referencia}).`,
        tipo: "FATURA_CRESCENDO",
        passivoId: passivo.id,
      });
    }
  }

  // Se isso disparar pra muitos passivos de uma vez, é sinal de uma carga
  // em lote (seed, importação inicial) — não um "surgiu uma dívida nova
  // do nada", que é o padrão de risco real que esse alerta quer pegar.
  if (passivosRecentesSemMeta.length > 0 && passivosRecentesSemMeta.length <= LIMITE_ALERTA_SEM_META) {
    for (const passivo of passivosRecentesSemMeta) {
      alertas.push({
        titulo: `${passivo.nome} ainda não está vinculado a nenhuma meta`,
        mensagem: "Foi cadastrado recentemente — vale decidir agora como ele entra na sua rota, antes de esquecer.",
        tipo: "SEM_META",
      });
    }
  }

  return alertas;
}

export { DIAS_PASSIVO_RECENTE };
