// Relatório de maiores ofensores (seção 4.3 do PRD): responde "com o que eu
// tô gastando mais", agrupado por categoria raiz e, dentro de cada uma que
// tenha subcategorias (ex: Empréstimo por credor, Cartão por cartão), o
// detalhamento por subcategoria — sem precisar reconstruir isso à mão a
// partir do extrato.

import { prisma } from "@/lib/prisma";
import { TipoTransacao } from "@/generated/prisma";
import type { MargemLivre } from "@/lib/margemLivre";
import { calcularParcelasCartaoNoMes } from "@/lib/parcelasFuturas";

// `protegida` reflete `Categoria.protegidaDeCorte` — só populado por
// `calcularMaioresOfensores` (a única fonte com categoria de verdade),
// usado pela sugestão de corte da IA (src/lib/promptCorteDeGastos.ts)
// pra nunca sugerir cortar algo marcado como fixo/já otimizado por
// outro caminho. `calcularOfensoresPorCredor` (ranking por credor, sem
// categoria) deixa o campo de fora — ausente equivale a "não protegida".
export type ItemRanking = { id: string; nome: string; totalCentavos: number; protegida?: boolean };
export type CategoriaComDetalhe = ItemRanking & { subcategorias: ItemRanking[] };

export type Periodo = "mes" | "trimestre" | "semestre" | "ano" | "tudo";

export function inicioDoPeriodo(periodo: Periodo, hoje: Date = new Date()): Date {
  if (periodo === "mes") return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  if (periodo === "trimestre") return new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
  if (periodo === "semestre") return new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
  if (periodo === "tudo") return new Date(2000, 0, 1);
  return new Date(hoje.getFullYear(), 0, 1);
}

// tipo tem DESPESA como padrão pra não quebrar quem já chama isso sem
// o segundo argumento — passar ENTRADA reaproveita o mesmo agrupamento
// (categoria raiz + subcategoria) pro lado da receita, pro relatório
// de /categorias que olha os dois lados ao mesmo tempo.
export async function calcularMaioresOfensores(
  desde: Date,
  tipo: TipoTransacao = TipoTransacao.DESPESA
): Promise<CategoriaComDetalhe[]> {
  const transacoes = await prisma.transacao.findMany({
    where: { tipo, ehTransferencia: false, data: { gte: desde } },
    select: {
      valorCentavos: true,
      categoria: {
        select: {
          id: true,
          nome: true,
          parentId: true,
          protegidaDeCorte: true,
          parent: { select: { id: true, nome: true, protegidaDeCorte: true } },
        },
      },
    },
  });

  const porRaiz = new Map<
    string,
    { nome: string; totalCentavos: number; protegida: boolean; subcategorias: Map<string, ItemRanking> }
  >();

  for (const t of transacoes) {
    if (!t.categoria) continue;
    const raiz = t.categoria.parent ?? { id: t.categoria.id, nome: t.categoria.nome, protegidaDeCorte: t.categoria.protegidaDeCorte };

    const entradaRaiz =
      porRaiz.get(raiz.id) ?? { nome: raiz.nome, totalCentavos: 0, protegida: raiz.protegidaDeCorte, subcategorias: new Map() };
    entradaRaiz.totalCentavos += t.valorCentavos;

    if (t.categoria.parentId) {
      const sub =
        entradaRaiz.subcategorias.get(t.categoria.id) ??
        { id: t.categoria.id, nome: t.categoria.nome, totalCentavos: 0, protegida: t.categoria.protegidaDeCorte };
      sub.totalCentavos += t.valorCentavos;
      entradaRaiz.subcategorias.set(t.categoria.id, sub);
    }

    porRaiz.set(raiz.id, entradaRaiz);
  }

  return Array.from(porRaiz.entries())
    .map(([id, v]) => ({
      id,
      nome: v.nome,
      totalCentavos: v.totalCentavos,
      protegida: v.protegida,
      subcategorias: Array.from(v.subcategorias.values()).sort((a, b) => b.totalCentavos - a.totalCentavos),
    }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos);
}

// Ranking pelo credor real (Passivo vinculado à transação), não pela
// categoria — responde de forma direta "quem pesou mais: o Agiota ou o
// Cartão", sem depender de como as categorias foram organizadas.
export async function calcularOfensoresPorCredor(desde: Date): Promise<ItemRanking[]> {
  const transacoes = await prisma.transacao.findMany({
    where: { tipo: "DESPESA", ehTransferencia: false, data: { gte: desde } },
    select: { valorCentavos: true, passivo: { select: { id: true, nome: true } } },
  });

  const porCredor = new Map<string, ItemRanking>();
  for (const t of transacoes) {
    const id = t.passivo?.id ?? "sem-vinculo";
    const nome = t.passivo?.nome ?? "Sem vínculo a um credor";
    const entrada = porCredor.get(id) ?? { id, nome, totalCentavos: 0 };
    entrada.totalCentavos += t.valorCentavos;
    porCredor.set(id, entrada);
  }

  return Array.from(porCredor.values()).sort((a, b) => b.totalCentavos - a.totalCentavos);
}

export type MovimentacaoDoMes = {
  entradasCentavos: number;
  despesasTotalCentavos: number;
  despesasPorCategoria: CategoriaComDetalhe[];
};

// Movimentação real do período (extrato de verdade, não configuração
// manual de recorrência) — entradas e despesas de fato lançadas, com as
// despesas detalhadas por categoria raiz E subcategoria (reaproveita
// calcularMaioresOfensores, que já faz esse agrupamento, em vez de
// duplicar o loop). Usado no resumo pra IA (src/lib/resumoIA.ts) e na
// sugestão de corte (src/lib/promptCorteDeGastos.ts) — essa última
// precisa da subcategoria pra não sugerir cortar uma raiz inteira (ex:
// "Moradia") quando ela mistura aluguel fixo com gasto revisável.
//
// entradasCentavos/despesasTotalCentavos vêm de agregados diretos, não
// de somar despesasPorCategoria — transação sem categoria entra no
// total mas não aparece na quebra por categoria, e não pode sumir do
// total por isso (mesma classe do bug do `take: 40` já corrigido antes).
export async function calcularMovimentacaoDoMes(desde: Date): Promise<MovimentacaoDoMes> {
  const [entradas, despesasTotal, despesasPorCategoria] = await Promise.all([
    prisma.transacao.aggregate({
      where: { tipo: "ENTRADA", ehTransferencia: false, data: { gte: desde } },
      _sum: { valorCentavos: true },
    }),
    prisma.transacao.aggregate({
      where: { tipo: "DESPESA", ehTransferencia: false, data: { gte: desde } },
      _sum: { valorCentavos: true },
    }),
    calcularMaioresOfensores(desde, TipoTransacao.DESPESA),
  ]);

  return {
    entradasCentavos: entradas._sum.valorCentavos ?? 0,
    despesasTotalCentavos: despesasTotal._sum.valorCentavos ?? 0,
    despesasPorCategoria,
  };
}

export type PontoEvolucaoMensal = { mes: string; entradasCentavos: number; despesasCentavos: number; projetado: boolean };

function somarMesesData(data: Date, offset: number): Date {
  return new Date(data.getFullYear(), data.getMonth() + offset, 1);
}

// Entrada x despesa real, mês a mês, pro gráfico de evolução do Mapa
// (src/app/(mapa)/page.tsx) — "estou melhorando ou piorando" de cara,
// sem abrir mais nada. Só entram meses com transação de verdade (o
// Map nunca cria uma entrada vazia), então chamar com
// inicioDoPeriodo("tudo") já devolve exatamente o histórico real, sem
// precisar de uma query separada pra achar a transação mais antiga.
//
// `margemLivre` opcional acrescenta UM ponto a mais no final — o mês
// seguinte, projetado a partir de entrada/despesa recorrente e parcela
// mínima já documentadas (mesma composição que calcularMargemLivre já
// usa como "saídas conhecidas", só exposta aqui, não recalculada).
// Só 1 mês à frente: recorrência é um regime permanente, projetar mais
// adiante repetiria o mesmo número sem informação nova.
export async function calcularEvolucaoMensal(desde: Date, margemLivre?: MargemLivre): Promise<PontoEvolucaoMensal[]> {
  const transacoes = await prisma.transacao.findMany({
    where: { ehTransferencia: false, data: { gte: desde } },
    select: { data: true, tipo: true, valorCentavos: true },
  });

  // Teto no mês corrente: um extrato pode trazer um agendamento com
  // data futura (ex: transferência já programada) sem que isso
  // signifique que aquele mês já fechou. Sem esse teto, 1-2
  // lançamentos futuros isolados virariam sozinhos um "mês real"
  // incompleto, e o ponto projetado abaixo pularia pro mês seguinte a
  // ESSE (dois meses à frente), em vez do próximo mês de verdade.
  const hoje = new Date();
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const porMes = new Map<string, PontoEvolucaoMensal>();
  for (const t of transacoes) {
    if (t.tipo !== "ENTRADA" && t.tipo !== "DESPESA") continue;
    const mes = `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, "0")}`;
    if (mes > mesAtualStr) continue;
    const ponto = porMes.get(mes) ?? { mes, entradasCentavos: 0, despesasCentavos: 0, projetado: false };
    if (t.tipo === "ENTRADA") ponto.entradasCentavos += t.valorCentavos;
    else ponto.despesasCentavos += t.valorCentavos;
    porMes.set(mes, ponto);
  }

  const pontos = Array.from(porMes.values()).sort((a, b) => a.mes.localeCompare(b.mes));

  if (margemLivre) {
    const ultimoMesReal = pontos.length > 0 ? pontos[pontos.length - 1].mes : null;
    const [ano, mesNum] = ultimoMesReal ? ultimoMesReal.split("-").map(Number) : [hoje.getFullYear(), hoje.getMonth() + 1];
    const proximoMes = somarMesesData(new Date(ano, mesNum - 1, 1), 1);
    const mesProjetado = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, "0")}`;
    const parcelasCartaoCentavos = await calcularParcelasCartaoNoMes(mesProjetado);
    pontos.push({
      mes: mesProjetado,
      entradasCentavos: margemLivre.entradasConfirmadasCentavos + margemLivre.entradasEstimadasCentavos,
      despesasCentavos:
        margemLivre.despesasRecorrentesCentavos +
        margemLivre.custoMensalPassivosCentavos +
        margemLivre.aporteMensalExtraCentavos +
        parcelasCartaoCentavos,
      projetado: true,
    });
  }

  return pontos;
}

export type PontoMensal = { mes: string; totalCentavos: number; projetado: boolean };
export type SerieMensal = { id: string; nome: string; porMes: PontoMensal[] };

// Quanto um passivo ainda paga por mês (custoMensalCentavos) e daqui a
// quantos meses ele quita, segundo a rota de ataque já escolhida
// (src/lib/estadoAtual.ts, encontrarOrdemMenosJuros) — null quando não
// converge dentro do horizonte simulado, ou quando o passivo não está na
// rota (já quitado, sem saldo documentado etc.).
export type ProjecaoCredor = { custoMensalCentavos: number; mesesAtePagar: number | null };

const TOP_SERIES_TENDENCIA = 5;
// Não faz sentido projetar gasto futuro pra sempre — 2 anos é um horizonte
// que já responde "quando eu respiro melhor" sem virar um gráfico infinito
// pra dívida que nunca converge dentro da simulação.
const HORIZONTE_MAXIMO_PROJECAO_MESES = 24;

function somarMeses(mesReferencia: string, offset: number): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const data = new Date(ano, mes - 1 + offset, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

// Série mensal de gasto, agrupada por credor ou por categoria raiz — pra
// comparar visualmente, mês a mês, quem pesou mais ao longo do tempo (ex:
// cartão dominando alguns meses, Agiota dominando outros). Limita às N
// maiores séries (pelo total do período todo) + um bucket "Outros", pra não
// virar um gráfico ilegível quando há muitos credores/categorias.
//
// Quando `agrupador` é "credor" e `projecaoPorCredor` é informado, cada
// série continua além do mês atual com o gasto mensal projetado daquele
// passivo (constante até o mês em que ele quita na rota escolhida, depois
// zero) — a mesma série, sem separar "gráfico do passado" de "gráfico do
// futuro".
export async function calcularTendenciaMensal(
  desde: Date,
  agrupador: "categoria" | "credor",
  projecaoPorCredor?: Map<string, ProjecaoCredor>
): Promise<SerieMensal[]> {
  const transacoes = await prisma.transacao.findMany({
    where: { tipo: "DESPESA", ehTransferencia: false, data: { gte: desde } },
    select: {
      data: true,
      valorCentavos: true,
      categoria: { select: { id: true, nome: true, parentId: true, parent: { select: { id: true, nome: true } } } },
      passivo: { select: { id: true, nome: true } },
    },
  });

  const mesesSet = new Set<string>();
  const porGrupo = new Map<string, { nome: string; porMes: Map<string, number> }>();

  for (const t of transacoes) {
    const mes = `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, "0")}`;
    mesesSet.add(mes);

    let id: string;
    let nome: string;
    if (agrupador === "credor") {
      id = t.passivo?.id ?? "sem-vinculo";
      nome = t.passivo?.nome ?? "Sem vínculo";
    } else {
      const raiz = t.categoria?.parent ?? (t.categoria ? { id: t.categoria.id, nome: t.categoria.nome } : null);
      id = raiz?.id ?? "sem-categoria";
      nome = raiz?.nome ?? "Sem categoria";
    }

    const grupo = porGrupo.get(id) ?? { nome, porMes: new Map<string, number>() };
    grupo.porMes.set(mes, (grupo.porMes.get(mes) ?? 0) + t.valorCentavos);
    porGrupo.set(id, grupo);
  }

  // Garante que o eixo de meses sempre inclui o mês atual, mesmo sem
  // nenhuma transação nele ainda — é o ponto onde o histórico (sólido)
  // termina e a projeção (tracejada) começa.
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  mesesSet.add(mesAtual);
  const mesesOrdenados = Array.from(mesesSet).sort();

  const gruposOrdenados = Array.from(porGrupo.entries())
    .map(([id, g]) => ({
      id,
      nome: g.nome,
      total: Array.from(g.porMes.values()).reduce((acc, v) => acc + v, 0),
      porMes: g.porMes,
    }))
    .sort((a, b) => b.total - a.total);

  const principais = gruposOrdenados.slice(0, TOP_SERIES_TENDENCIA);
  const outros = gruposOrdenados.slice(TOP_SERIES_TENDENCIA);

  function pontosHistorico(porMes: Map<string, number>): PontoMensal[] {
    return mesesOrdenados.map((mes) => ({ mes, totalCentavos: porMes.get(mes) ?? 0, projetado: false }));
  }

  function pontosProjetados(ids: string[]): PontoMensal[] {
    if (agrupador !== "credor" || !projecaoPorCredor) return [];
    const projecoes = ids.map((id) => projecaoPorCredor.get(id)).filter((p): p is ProjecaoCredor => p != null);
    if (projecoes.length === 0) return [];

    const horizonte = Math.min(
      Math.max(...projecoes.map((p) => p.mesesAtePagar ?? HORIZONTE_MAXIMO_PROJECAO_MESES)),
      HORIZONTE_MAXIMO_PROJECAO_MESES
    );

    const pontos: PontoMensal[] = [];
    for (let i = 1; i <= horizonte; i++) {
      const totalCentavos = projecoes.reduce(
        (acc, p) => acc + (p.mesesAtePagar == null || i <= p.mesesAtePagar ? p.custoMensalCentavos : 0),
        0
      );
      pontos.push({ mes: somarMeses(mesAtual, i), totalCentavos, projetado: true });
    }
    return pontos;
  }

  const series: SerieMensal[] = principais.map((g) => ({
    id: g.id,
    nome: g.nome,
    porMes: [...pontosHistorico(g.porMes), ...pontosProjetados([g.id])],
  }));

  if (outros.length > 0) {
    const porMesOutros = new Map(
      mesesOrdenados.map((mes) => [mes, outros.reduce((acc, g) => acc + (g.porMes.get(mes) ?? 0), 0)])
    );
    series.push({
      id: "outros",
      nome: "Outros",
      porMes: [...pontosHistorico(porMesOutros), ...pontosProjetados(outros.map((g) => g.id))],
    });
  }

  return series;
}

export type PontoSaldo = { data: string; valorCentavos: number };

// Saldo devedor real de um passivo ao longo do tempo, a partir dos
// registros de PassivoHistorico gravados toda vez que o Felipe atualiza o
// valor de quitação (src/app/passivos/actions.ts). Sem nenhum registro
// ainda, devolve só o valor atual como ponto único — nunca inventa pontos
// intermediários que não foram documentados.
export async function calcularTrajetoriaRealPassivo(passivoId: string): Promise<PontoSaldo[]> {
  const [passivo, historico] = await Promise.all([
    prisma.passivo.findUnique({ where: { id: passivoId }, select: { valorQuitacaoCentavos: true, createdAt: true } }),
    prisma.passivoHistorico.findMany({
      where: { passivoId, campo: "valorQuitacaoCentavos" },
      orderBy: { registradoEm: "asc" },
    }),
  ]);

  if (!passivo) return [];

  const pontos: PontoSaldo[] = [];

  if (historico.length > 0) {
    const primeiroValorAnterior = historico[0].valorAnterior;
    if (primeiroValorAnterior && !Number.isNaN(Number(primeiroValorAnterior))) {
      pontos.push({ data: passivo.createdAt.toISOString(), valorCentavos: Number(primeiroValorAnterior) });
    }
    for (const h of historico) {
      const valor = Number(h.valorNovo);
      if (!Number.isNaN(valor)) {
        pontos.push({ data: h.registradoEm.toISOString(), valorCentavos: valor });
      }
    }
  } else if (passivo.valorQuitacaoCentavos != null) {
    pontos.push({ data: passivo.createdAt.toISOString(), valorCentavos: passivo.valorQuitacaoCentavos });
  }

  return pontos;
}

export type Variacao = {
  id: string;
  nome: string;
  mesAtual: string;
  mesAnterior: string;
  valorAtualCentavos: number;
  valorAnteriorCentavos: number;
  variacaoCentavos: number;
  variacaoPct: number | null;
};

// Compara os dois últimos meses com dado real (nunca projeção) de cada
// série já calculada por calcularTendenciaMensal — é a "análise que fala
// com os dados" sem precisar de IA nenhuma: reaproveita o que já existe em
// vez de reconstruir histórico do zero. Ordenado pela maior variação em
// R$ (não em %, pra não colocar uma categoria de R$20 que dobrou acima de
// uma de R$5.000 que subiu 10%).
export function calcularMaioresVariacoes(series: SerieMensal[]): Variacao[] {
  const variacoes: Variacao[] = [];

  for (const serie of series) {
    const reais = serie.porMes.filter((p) => !p.projetado);
    if (reais.length < 2) continue;

    const atual = reais[reais.length - 1];
    const anterior = reais[reais.length - 2];
    const variacaoCentavos = atual.totalCentavos - anterior.totalCentavos;

    variacoes.push({
      id: serie.id,
      nome: serie.nome,
      mesAtual: atual.mes,
      mesAnterior: anterior.mes,
      valorAtualCentavos: atual.totalCentavos,
      valorAnteriorCentavos: anterior.totalCentavos,
      variacaoCentavos,
      variacaoPct: anterior.totalCentavos > 0 ? (variacaoCentavos / anterior.totalCentavos) * 100 : null,
    });
  }

  return variacoes.sort((a, b) => Math.abs(b.variacaoCentavos) - Math.abs(a.variacaoCentavos));
}

const MESES_HISTORICO_CARTAO = 6;
const MESES_PROJECAO_CARTAO = 3;
const JANELA_MEDIA_PROJECAO_CARTAO = 3;

// Histórico de gasto mensal de UM cartão + tendência futura pela média dos
// últimos meses reais com gasto — diferente de calcularTendenciaMensal
// (que projeta "quando quita" como um empréstimo amortizando até zerar):
// cartão é revolvente, continua sendo usado, não tem uma data de quitação
// natural. Aqui o "futuro" é só "se você continuar no ritmo recente",
// constante pelos próximos meses — sem tentar advinhar quando o cartão
// "acaba".
export async function calcularHistoricoComTendenciaCartao(passivoId: string, nome: string): Promise<SerieMensal> {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const desde = new Date(hoje.getFullYear(), hoje.getMonth() - (MESES_HISTORICO_CARTAO - 1), 1);

  const transacoes = await prisma.transacao.findMany({
    where: { tipo: "DESPESA", ehTransferencia: false, passivoId, data: { gte: desde } },
    select: { data: true, valorCentavos: true },
  });

  const porMes = new Map<string, number>();
  for (const t of transacoes) {
    const mes = `${t.data.getFullYear()}-${String(t.data.getMonth() + 1).padStart(2, "0")}`;
    porMes.set(mes, (porMes.get(mes) ?? 0) + t.valorCentavos);
  }

  const mesesOrdenados = Array.from({ length: MESES_HISTORICO_CARTAO }, (_, i) =>
    somarMeses(mesAtual, -(MESES_HISTORICO_CARTAO - 1 - i))
  );

  const pontosReais: PontoMensal[] = mesesOrdenados.map((mes) => ({
    mes,
    totalCentavos: porMes.get(mes) ?? 0,
    projetado: false,
  }));

  // Média só dos meses com gasto de fato — um mês de fatura zerada (cartão
  // parado) não deveria puxar a média pra baixo artificialmente.
  const baseMedia = pontosReais.filter((p) => p.totalCentavos > 0).slice(-JANELA_MEDIA_PROJECAO_CARTAO);
  const mediaCentavos =
    baseMedia.length > 0 ? Math.round(baseMedia.reduce((acc, p) => acc + p.totalCentavos, 0) / baseMedia.length) : 0;

  const pontosProjetados: PontoMensal[] =
    mediaCentavos > 0
      ? Array.from({ length: MESES_PROJECAO_CARTAO }, (_, i) => ({
          mes: somarMeses(mesAtual, i + 1),
          totalCentavos: mediaCentavos,
          projetado: true,
        }))
      : [];

  return { id: passivoId, nome, porMes: [...pontosReais, ...pontosProjetados] };
}
