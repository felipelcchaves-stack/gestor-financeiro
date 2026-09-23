// Compras parceladas em aberto de um cartão — o "olhar pra frente" que a
// importação de fatura sozinha não dá: uma compra em 10x aparece, mês a
// mês, como uma linha separada em cada fatura importada, sem nada juntando
// "isso ainda vai cobrar mais 7 vezes".

import { prisma } from "@/lib/prisma";
import { normalizarDescricao } from "@/lib/classificacao";
import { StatusPassivo } from "@/generated/prisma";

export type ParcelaAberta = {
  transacaoId: string;
  descricao: string;
  valorCentavos: number;
  parcelaAtual: number;
  totalParcelas: number;
  parcelasRestantes: number;
  valorRestanteCentavos: number;
  proximosMeses: string[]; // "YYYY-MM", um por parcela restante
};

function somarMeses(data: Date, offset: number): Date {
  return new Date(data.getFullYear(), data.getMonth() + offset, 1);
}

function formatarMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

// A mesma compra costuma ser importada mais de uma vez (fatura de outubro
// traz "LOJA 2/10", fatura de novembro traz "LOJA 3/10" da mesma compra) —
// agrupa por descrição normalizada + valor + total de parcelas
// (normalizarDescricao já remove os dígitos, então "2/10" e "3/10" caem na
// mesma chave) e usa só o registro de maior parcelaAtual, senão as parcelas
// restantes seriam contadas em dobro.
export async function calcularParcelasAbertas(passivoId: string): Promise<ParcelaAberta[]> {
  const transacoes = await prisma.transacao.findMany({
    where: { passivoId, tipo: "DESPESA", ehTransferencia: false, totalParcelas: { not: null }, parcelaAtual: { not: null } },
    orderBy: { data: "asc" },
    select: { id: true, data: true, descricao: true, valorCentavos: true, parcelaAtual: true, totalParcelas: true },
  });

  const porGrupo = new Map<string, (typeof transacoes)[number]>();
  for (const t of transacoes) {
    const chave = `${normalizarDescricao(t.descricao)}|${t.valorCentavos}|${t.totalParcelas}`;
    const atual = porGrupo.get(chave);
    if (!atual || (t.parcelaAtual ?? 0) > (atual.parcelaAtual ?? 0)) {
      porGrupo.set(chave, t);
    }
  }

  const abertas: ParcelaAberta[] = [];
  for (const t of porGrupo.values()) {
    const parcelaAtual = t.parcelaAtual!;
    const totalParcelas = t.totalParcelas!;
    if (parcelaAtual >= totalParcelas) continue; // já quitada

    const parcelasRestantes = totalParcelas - parcelaAtual;
    const proximosMeses = Array.from({ length: parcelasRestantes }, (_, i) => formatarMes(somarMeses(t.data, i + 1)));

    abertas.push({
      transacaoId: t.id,
      descricao: t.descricao,
      valorCentavos: t.valorCentavos,
      parcelaAtual,
      totalParcelas,
      parcelasRestantes,
      valorRestanteCentavos: parcelasRestantes * t.valorCentavos,
      proximosMeses,
    });
  }

  return abertas.sort((a, b) => b.valorRestanteCentavos - a.valorRestanteCentavos);
}

// Soma, entre todos os cartões ativos, quanto de parcela JÁ SABIDA
// (compra parcelada já lançada em fatura importada) vai cobrar num mês
// específico — usado pelo ponto projetado de calcularEvolucaoMensal
// (src/lib/ofensores.ts) como despesa de cartão documentada, nunca
// estimada (gasto novo ainda não feito no cartão fica de fora de
// propósito — decisão do Felipe, ver ROADMAP.md).
export async function calcularParcelasCartaoNoMes(mesAlvo: string): Promise<number> {
  const cartoesAtivos = await prisma.passivo.findMany({
    where: { tipo: "cartao", status: StatusPassivo.ATIVO },
    select: { id: true },
  });

  const todasAsAbertas = await Promise.all(cartoesAtivos.map((c) => calcularParcelasAbertas(c.id)));

  return todasAsAbertas
    .flat()
    .filter((p) => p.proximosMeses.includes(mesAlvo))
    .reduce((acc, p) => acc + p.valorCentavos, 0);
}
