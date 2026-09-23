// Score de saúde financeira: um número único (0-100) agregando os sinais
// que o Consultor já calcula separadamente — reserva de emergência, margem
// livre, cheque especial em uso, fatura crescendo — pra dar um jeito rápido
// de acompanhar progresso mês a mês, sem precisar olhar 4 cartões diferentes.
// Cada componente também vira um "fator" com dica acionável, pra responder
// não só "qual é a nota" mas "o que eu faço pra chegar em 100".

import { formatarBRL } from "@/lib/money";

export type ScoreSaude = {
  pontos: number;
  faixa: "SAUDAVEL" | "ATENCAO" | "CRITICO";
  label: string;
  fatores: FatorScore[];
};

export type FatorScore = {
  nome: string;
  pontosAtuais: number;
  pontosMaximos: number;
  dica: string;
  href?: string;
};

export function calcularScoreSaude(input: {
  reservaAtualCentavos: number;
  reservaAlvoCentavos: number;
  temFolego: boolean;
  chequeEspecialEmUso: boolean;
  faturaCrescendo: boolean;
  faturaCrescendoPassivoId?: string;
  // true quando o rateio automático (src/lib/rateio.ts) não está
  // configurado (não penaliza quem não usa esse recurso) ou quando
  // está em dia; false só quando a regra existe e falta separar algo
  // de verdade.
  rateioOk: boolean;
}): ScoreSaude {
  const {
    reservaAtualCentavos,
    reservaAlvoCentavos,
    temFolego,
    chequeEspecialEmUso,
    faturaCrescendo,
    faturaCrescendoPassivoId,
    rateioOk,
  } = input;

  const percentualReserva = reservaAlvoCentavos === 0 ? 1 : Math.min(1, reservaAtualCentavos / reservaAlvoCentavos);
  const pontosReserva = percentualReserva * 25;
  const pontosMargemLivre = temFolego ? 25 : 0;
  const pontosChequeEspecial = chequeEspecialEmUso ? 0 : 20;
  const pontosFatura = faturaCrescendo ? 0 : 20;
  const pontosRateio = rateioOk ? 10 : 0;

  const pontos = Math.round(pontosReserva + pontosMargemLivre + pontosChequeEspecial + pontosFatura + pontosRateio);

  const faixa = pontos >= 80 ? "SAUDAVEL" : pontos >= 50 ? "ATENCAO" : "CRITICO";
  const label = faixa === "SAUDAVEL" ? "Saudável" : faixa === "ATENCAO" ? "Atenção" : "Crítico";

  const faltaReserva = reservaAlvoCentavos - reservaAtualCentavos;

  const fatores: FatorScore[] = [
    {
      nome: "Reserva de emergência",
      pontosAtuais: Math.round(pontosReserva),
      pontosMaximos: 25,
      dica:
        faltaReserva > 0
          ? `Faltam ${formatarBRL(faltaReserva)} pra completar a meta de 3 meses de despesas. Simule uma entrada pontual pra ela aqui embaixo, ou reduza despesas recorrentes.`
          : "Reserva completa — 25 de 25 pontos.",
      href: faltaReserva > 0 ? "/recorrencias" : undefined,
    },
    {
      nome: "Margem livre",
      pontosAtuais: pontosMargemLivre,
      pontosMaximos: 25,
      dica: temFolego
        ? "Margem livre positiva — 25 de 25 pontos."
        : "Margem livre zerada ou negativa. Veja seus maiores gastos e ajuste despesas recorrentes antes de acelerar quitação de dívida.",
      href: temFolego ? undefined : "/ofensores",
    },
    {
      nome: "Cheque especial",
      pontosAtuais: pontosChequeEspecial,
      pontosMaximos: 20,
      dica: chequeEspecialEmUso
        ? "Você está usando o cheque especial de alguma conta — é o crédito mais caro que existe. Resolver isso vale 20 pontos."
        : "Sem uso de cheque especial — 20 de 20 pontos.",
      href: chequeEspecialEmUso ? "/contas" : undefined,
    },
    {
      nome: "Fatura de cartão",
      pontosAtuais: pontosFatura,
      pontosMaximos: 20,
      dica: faturaCrescendo
        ? "Uma fatura voltou a crescer em relação ao ciclo anterior. Vale entender por quê antes que vire um padrão."
        : "Nenhuma fatura crescendo — 20 de 20 pontos.",
      href: faturaCrescendo && faturaCrescendoPassivoId ? `/passivos/${faturaCrescendoPassivoId}` : undefined,
    },
    {
      nome: "Reserva pra dívida",
      pontosAtuais: pontosRateio,
      pontosMaximos: 10,
      dica: rateioOk
        ? "Rateio automático em dia (ou não configurado) — 10 de 10 pontos."
        : "Você configurou separar um % da receita pra quitar dívida, mas ainda falta separar o que já entrou. Confira em Consultor.",
      href: rateioOk ? undefined : "/consultor",
    },
  ];

  return { pontos, faixa, label, fatores };
}
