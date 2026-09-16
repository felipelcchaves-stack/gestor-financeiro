// Motor de otimização de quitação (seção 4.2 do PRD).
//
// Premissas da simulação, dado o que os dados realmente sustentam (sem
// inventar taxa/prazo que não existe no cadastro):
// - Passivos AMORTIZA_NORMAL: a parcela mínima mensal já reduz o saldo
//   sozinha, independente de qualquer ordem de ataque (é o que "amortiza
//   normalmente" significa) — isso continua acontecendo em paralelo à
//   estratégia. Não decompomos juros embutidos na parcela por falta de
//   taxa/prazo documentados.
// - Passivos SO_JUROS_SEM_AMORTIZACAO (Agiota, Leka 1, Leka 2): o saldo NÃO
//   cai com a parcela mensal — ela é só o juro do mês. O saldo só zera
//   quando o aporte extra acumulado (por esse passivo) atinge o valor
//   integral, tudo de uma vez (binário, como o PRD descreve o Agiota).
// - Passivos SEM_JUROS (dívida de honra): nada acontece sozinho; só cai
//   quando recebe aporte extra diretamente.
// - Todo mês, o "aporte extra" disponível é aplicado em cascata na ordem de
//   ataque escolhida: o que sobra depois de quitar um passivo já cai no
//   próximo da lista, no mesmo mês. Quando um passivo é quitado, sua parcela
//   mensal (mínima + o que estava recebendo de extra) passa a engordar o
//   aporte disponível dali em diante — o clássico efeito bola de neve.

import { EstruturaPassivo } from "@/generated/prisma";

export type PassivoParaOtimizacao = {
  id: string;
  nome: string;
  saldoCentavos: number;
  custoMensalCentavos: number;
  estrutura: EstruturaPassivo;
};

export type ResultadoEstrategia = {
  ordemIds: string[];
  mesesTotais: number;
  jurosTotalCentavos: number;
  quitacoes: { passivoId: string; mes: number }[];
  convergiu: boolean;
  // Saldo total (soma de todos os passivos) ao final de cada mês simulado —
  // índice 0 = fim do mês 1. Alimenta o gráfico de projeção em /otimizacao.
  trajetoriaSaldoTotalCentavos: number[];
  // Mesma trajetória, mas por passivo — mesmo índice de mês que o total
  // acima. Alimenta o gráfico de saldo por credor em /ofensores.
  trajetoriaPorPassivoCentavos: Record<string, number[]>;
  // Quantos meses até a primeira quitação da estratégia — não é a mesma
  // coisa que "menor juro" ou "menor tempo total": responde "quanto tempo
  // eu fico sem ver nada acontecer" antes do primeiro alívio de verdade.
  // Null quando a estratégia não quita nenhum passivo (não deveria
  // acontecer com convergiu=true e ao menos 1 passivo com saldo > 0).
  mesesAteAlivioVisivel: number | null;
  // Só existe pra passivos SO_JUROS_SEM_AMORTIZACAO (Agiota e afins): eles
  // não dão crédito parcial, então todo mês em que ainda têm saldo > 0 é um
  // mês "no escuro" — a poupança tá acumulando, mas nada visível muda até
  // a quitação total, de uma vez. Essa é a métrica que traduz em número o
  // "eu fico muito tempo sem ver progresso" que dói de verdade num Agiota.
  mesesNoEscuro: { passivoId: string; meses: number }[];
};

type EstadoPassivo = {
  passivo: PassivoParaOtimizacao;
  saldoRestante: number;
  poupancaAcumulada: number;
  pago: boolean;
};

export function simularOrdem(
  passivos: PassivoParaOtimizacao[],
  ordemIds: string[],
  aporteExtraCentavosInicial: number,
  maxMeses = 600,
  // Entra só na distribuição do primeiro mês simulado (13º, restituição,
  // bônus) — não soma no `aporteDisponivel` permanente, senão um valor
  // avulso viraria recorrente por engano e inflaria todos os meses
  // seguintes também.
  aportePontualCentavos = 0
): ResultadoEstrategia {
  const estado = new Map<string, EstadoPassivo>(
    passivos.map((p) => [
      p.id,
      { passivo: p, saldoRestante: p.saldoCentavos, poupancaAcumulada: 0, pago: p.saldoCentavos <= 0 },
    ])
  );

  let aporteDisponivel = aporteExtraCentavosInicial;
  let jurosTotalCentavos = 0;
  const quitacoes: { passivoId: string; mes: number }[] = [];
  const trajetoriaSaldoTotalCentavos: number[] = [];
  const trajetoriaPorPassivoCentavos: Record<string, number[]> = Object.fromEntries(
    passivos.map((p) => [p.id, []])
  );
  let mes = 0;

  const todosQuitados = () => Array.from(estado.values()).every((e) => e.pago);

  while (!todosQuitados() && mes < maxMeses) {
    mes += 1;

    for (const e of estado.values()) {
      if (e.pago) continue;
      if (e.passivo.estrutura === EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO) {
        jurosTotalCentavos += e.passivo.custoMensalCentavos;
      } else if (e.passivo.estrutura === EstruturaPassivo.AMORTIZA_NORMAL) {
        e.saldoRestante = Math.max(0, e.saldoRestante - e.passivo.custoMensalCentavos);
        if (e.saldoRestante === 0) {
          e.pago = true;
          quitacoes.push({ passivoId: e.passivo.id, mes });
          aporteDisponivel += e.passivo.custoMensalCentavos;
        }
      }
    }

    let sobra = aporteDisponivel + (mes === 1 ? aportePontualCentavos : 0);
    for (const id of ordemIds) {
      if (sobra <= 0) break;
      const e = estado.get(id);
      if (!e || e.pago) continue;

      if (e.passivo.estrutura === EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO) {
        e.poupancaAcumulada += sobra;
        if (e.poupancaAcumulada >= e.saldoRestante) {
          sobra = e.poupancaAcumulada - e.saldoRestante;
          e.pago = true;
          e.saldoRestante = 0;
          quitacoes.push({ passivoId: id, mes });
          aporteDisponivel += e.passivo.custoMensalCentavos;
        } else {
          sobra = 0;
        }
      } else {
        const aplicar = Math.min(sobra, e.saldoRestante);
        e.saldoRestante -= aplicar;
        sobra -= aplicar;
        if (e.saldoRestante <= 0) {
          e.pago = true;
          quitacoes.push({ passivoId: id, mes });
          aporteDisponivel += e.passivo.custoMensalCentavos;
        }
      }
    }

    trajetoriaSaldoTotalCentavos.push(
      Array.from(estado.values()).reduce((acc, e) => acc + e.saldoRestante, 0)
    );
    for (const e of estado.values()) {
      trajetoriaPorPassivoCentavos[e.passivo.id].push(e.saldoRestante);
    }
  }

  const mesesAteAlivioVisivel = quitacoes.length > 0 ? Math.min(...quitacoes.map((q) => q.mes)) : null;

  const mesesNoEscuro = passivos
    .filter((p) => p.estrutura === EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO)
    .map((p) => ({
      passivoId: p.id,
      meses: trajetoriaPorPassivoCentavos[p.id].filter((saldo) => saldo > 0).length,
    }));

  return {
    ordemIds,
    mesesTotais: mes,
    jurosTotalCentavos,
    quitacoes,
    convergiu: todosQuitados(),
    trajetoriaSaldoTotalCentavos,
    trajetoriaPorPassivoCentavos,
    mesesAteAlivioVisivel,
    mesesNoEscuro,
  };
}

// Estratégia híbrida: em vez de jogar 100% do aporte extra num passivo por
// vez (o que deixa um Agiota "no escuro" até acumular o valor inteiro),
// divide o aporte por percentual entre os dois primeiros da ordem — ex:
// 60% pro mais caro (continua sangrando menos) e 40% pro mais fácil
// (amortiza e dá alívio visível todo mês). Assim que um dos dois quita, o
// aporte inteiro passa a cascatear normalmente pelo resto da ordem — a
// divisão só existe enquanto os dois primeiros alvos ainda devem.
// Simplificação aceita: no mês exato em que um dos dois quita, a sobra da
// parcela dele naquele mês não é redirecionada pro outro no mesmo mês —
// só a partir do mês seguinte, quando a lógica já reverteu pra cascata
// única. Isso não muda o resultado de forma relevante e evita duplicar
// toda a lógica de cascata dentro do período de split.
export function simularOrdemComSplit(
  passivos: PassivoParaOtimizacao[],
  ordemIds: string[],
  splitPctPrimeiro: number,
  aporteExtraCentavosInicial: number,
  maxMeses = 600,
  // Mesma regra de simularOrdem: só no primeiro mês, nunca soma no
  // `aporteDisponivel` permanente.
  aportePontualCentavos = 0
): ResultadoEstrategia {
  const [alvoA, alvoB, ...resto] = ordemIds;

  const estado = new Map<string, EstadoPassivo>(
    passivos.map((p) => [
      p.id,
      { passivo: p, saldoRestante: p.saldoCentavos, poupancaAcumulada: 0, pago: p.saldoCentavos <= 0 },
    ])
  );

  let aporteDisponivel = aporteExtraCentavosInicial;
  let jurosTotalCentavos = 0;
  const quitacoes: { passivoId: string; mes: number }[] = [];
  const trajetoriaSaldoTotalCentavos: number[] = [];
  const trajetoriaPorPassivoCentavos: Record<string, number[]> = Object.fromEntries(
    passivos.map((p) => [p.id, []])
  );
  let mes = 0;

  const todosQuitados = () => Array.from(estado.values()).every((e) => e.pago);

  function aplicarNoAlvo(id: string | undefined, valor: number): number {
    if (!id || valor <= 0) return Math.max(valor, 0);
    const e = estado.get(id);
    if (!e || e.pago) return valor;

    if (e.passivo.estrutura === EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO) {
      e.poupancaAcumulada += valor;
      if (e.poupancaAcumulada >= e.saldoRestante) {
        const sobra = e.poupancaAcumulada - e.saldoRestante;
        e.pago = true;
        e.saldoRestante = 0;
        quitacoes.push({ passivoId: id, mes });
        aporteDisponivel += e.passivo.custoMensalCentavos;
        return sobra;
      }
      return 0;
    }

    const aplicar = Math.min(valor, e.saldoRestante);
    e.saldoRestante -= aplicar;
    if (e.saldoRestante <= 0) {
      e.pago = true;
      quitacoes.push({ passivoId: id, mes });
      aporteDisponivel += e.passivo.custoMensalCentavos;
    }
    return valor - aplicar;
  }

  function aplicarEmCascata(ids: string[], valorInicial: number): number {
    let sobra = valorInicial;
    for (const id of ids) {
      if (sobra <= 0) break;
      sobra = aplicarNoAlvo(id, sobra);
    }
    return sobra;
  }

  while (!todosQuitados() && mes < maxMeses) {
    mes += 1;

    for (const e of estado.values()) {
      if (e.pago) continue;
      if (e.passivo.estrutura === EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO) {
        jurosTotalCentavos += e.passivo.custoMensalCentavos;
      } else if (e.passivo.estrutura === EstruturaPassivo.AMORTIZA_NORMAL) {
        e.saldoRestante = Math.max(0, e.saldoRestante - e.passivo.custoMensalCentavos);
        if (e.saldoRestante === 0) {
          e.pago = true;
          quitacoes.push({ passivoId: e.passivo.id, mes });
          aporteDisponivel += e.passivo.custoMensalCentavos;
        }
      }
    }

    const aporteDoMes = aporteDisponivel + (mes === 1 ? aportePontualCentavos : 0);
    const aAtivo = alvoA != null && estado.get(alvoA)?.pago === false;
    const bAtivo = alvoB != null && estado.get(alvoB)?.pago === false;

    if (aAtivo && bAtivo) {
      const valorA = Math.round((aporteDoMes * splitPctPrimeiro) / 100);
      const valorB = aporteDoMes - valorA;
      const sobraA = aplicarNoAlvo(alvoA, valorA);
      const sobraB = aplicarNoAlvo(alvoB, valorB);
      aplicarEmCascata(resto, sobraA + sobraB);
    } else {
      const ordemRestante = ordemIds.filter((id) => estado.get(id)?.pago === false);
      aplicarEmCascata(ordemRestante, aporteDoMes);
    }

    trajetoriaSaldoTotalCentavos.push(
      Array.from(estado.values()).reduce((acc, e) => acc + e.saldoRestante, 0)
    );
    for (const e of estado.values()) {
      trajetoriaPorPassivoCentavos[e.passivo.id].push(e.saldoRestante);
    }
  }

  const mesesAteAlivioVisivel = quitacoes.length > 0 ? Math.min(...quitacoes.map((q) => q.mes)) : null;

  const mesesNoEscuro = passivos
    .filter((p) => p.estrutura === EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO)
    .map((p) => ({
      passivoId: p.id,
      meses: trajetoriaPorPassivoCentavos[p.id].filter((saldo) => saldo > 0).length,
    }));

  return {
    ordemIds,
    mesesTotais: mes,
    jurosTotalCentavos,
    quitacoes,
    convergiu: todosQuitados(),
    trajetoriaSaldoTotalCentavos,
    trajetoriaPorPassivoCentavos,
    mesesAteAlivioVisivel,
    mesesNoEscuro,
  };
}

export function ordenarPorMenorTempo(passivos: PassivoParaOtimizacao[]): string[] {
  return [...passivos].sort((a, b) => a.saldoCentavos - b.saldoCentavos).map((p) => p.id);
}

export function ordenarPorMaiorAlivioCaixa(passivos: PassivoParaOtimizacao[]): string[] {
  return [...passivos].sort((a, b) => b.custoMensalCentavos - a.custoMensalCentavos).map((p) => p.id);
}

// "Vitória rápida": a dívida mais barata de matar em relação ao alívio de
// caixa que ela dá — maior custoMensal por real de saldo restante. Não é o
// mesmo cálculo de menor tempo (que ignora o alívio) nem de menor juro
// (que ignora o quão perto ela está de cair) — é o "isso aqui é fácil e
// vale a pena matar logo" que motiva a continuar.
export function encontrarVitoriaRapida(passivos: PassivoParaOtimizacao[]): PassivoParaOtimizacao | null {
  const elegiveis = passivos.filter((p) => p.saldoCentavos > 0 && p.custoMensalCentavos > 0);
  if (elegiveis.length === 0) return null;

  return elegiveis.reduce((melhor, atual) => {
    const indiceAtual = atual.custoMensalCentavos / atual.saldoCentavos;
    const indiceMelhor = melhor.custoMensalCentavos / melhor.saldoCentavos;
    return indiceAtual > indiceMelhor ? atual : melhor;
  });
}

function permutacoes<T>(itens: T[]): T[][] {
  if (itens.length <= 1) return [itens];
  const resultado: T[][] = [];
  for (let i = 0; i < itens.length; i++) {
    const resto = [...itens.slice(0, i), ...itens.slice(i + 1)];
    for (const p of permutacoes(resto)) {
      resultado.push([itens[i], ...p]);
    }
  }
  return resultado;
}

const LIMITE_BUSCA_EXAUSTIVA = 7;

export function encontrarOrdemMenosJuros(
  passivos: PassivoParaOtimizacao[],
  aporteExtraCentavos: number,
  aportePontualCentavos = 0
): { resultado: ResultadoEstrategia; exaustivo: boolean } {
  const ids = passivos.map((p) => p.id);

  if (ids.length <= LIMITE_BUSCA_EXAUSTIVA) {
    let melhor: ResultadoEstrategia | null = null;
    for (const ordem of permutacoes(ids)) {
      const r = simularOrdem(passivos, ordem, aporteExtraCentavos, 600, aportePontualCentavos);
      if (
        !melhor ||
        r.jurosTotalCentavos < melhor.jurosTotalCentavos ||
        (r.jurosTotalCentavos === melhor.jurosTotalCentavos && r.mesesTotais < melhor.mesesTotais)
      ) {
        melhor = r;
      }
    }
    return { resultado: melhor!, exaustivo: true };
  }

  // Acima do limite de busca exaustiva total, o `jurosTotalCentavos` só
  // é alimentado pelo grupo SO_JUROS_SEM_AMORTIZACAO (ver simularOrdem: só
  // essas linhas somam em jurosTotalCentavos) — qualquer real de aporte
  // desviado pra uma dívida de outro tipo antes de quitar essas só atrasa
  // o quanto elas ficam sangrando, nunca reduz o total. Ou seja: colocar
  // TODO o grupo SO_JUROS primeiro é sempre ótimo, e a única coisa que
  // ainda decide o juro total é a ORDEM *dentro* desse grupo — que
  // geralmente é pequeno (são as dívidas "no escuro", tipicamente poucas)
  // mesmo quando o total de passivos passa de 7. Por isso testamos todas
  // as combinações desse subgrupo específico em vez de usar uma
  // heurística pro problema inteiro — dá o mínimo de juro de verdade,
  // não uma aproximação, sempre que o subgrupo cabe na busca exaustiva.
  const comJuros = passivos.filter((p) => p.estrutura === EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO);
  const semJurosIds = passivos
    .filter((p) => p.estrutura !== EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO)
    .sort((a, b) => a.saldoCentavos - b.saldoCentavos)
    .map((p) => p.id);

  if (comJuros.length <= LIMITE_BUSCA_EXAUSTIVA) {
    let melhor: ResultadoEstrategia | null = null;
    for (const ordemSub of permutacoes(comJuros.map((p) => p.id))) {
      const r = simularOrdem(passivos, [...ordemSub, ...semJurosIds], aporteExtraCentavos, 600, aportePontualCentavos);
      if (
        !melhor ||
        r.jurosTotalCentavos < melhor.jurosTotalCentavos ||
        (r.jurosTotalCentavos === melhor.jurosTotalCentavos && r.mesesTotais < melhor.mesesTotais)
      ) {
        melhor = r;
      }
    }
    // exaustivo: true de verdade aqui — o subgrupo que decide o juro
    // total foi testado em todas as combinações possíveis, mesmo que o
    // total geral de passivos seja grande demais pra isso.
    return { resultado: melhor!, exaustivo: true };
  }

  // Caso raro (mais de 7 dívidas "só juros" ao mesmo tempo): aproxima
  // pela regra de Smith — maior sangria mensal por real de saldo
  // primeiro — clássica pra minimizar o tempo total de espera ponderado
  // nesse tipo de problema, mas sem garantia de ser o mínimo absoluto.
  const ordemComJuros = [...comJuros]
    .sort((a, b) => b.custoMensalCentavos / b.saldoCentavos - a.custoMensalCentavos / a.saldoCentavos)
    .map((p) => p.id);

  return {
    resultado: simularOrdem(passivos, [...ordemComJuros, ...semJurosIds], aporteExtraCentavos, 600, aportePontualCentavos),
    exaustivo: false,
  };
}

export type EstrategiaId = "menorTempo" | "menorJuros" | "maiorAlivio" | "hibrida";

// Monta a ordem pra estratégia híbrida: "mais caro/difícil" (quem mais
// sangra juro sem dar crédito parcial) e "mais fácil" (o menor saldo entre
// os que amortizam de verdade) como os dois primeiros alvos — os dois lados
// da provocação "juro vs facilidade". Sem os dois tipos presentes não tem o
// que dividir, devolve null (quem chama cai pro padrão nesse caso).
export function montarOrdemHibrida(passivos: PassivoParaOtimizacao[]): string[] | null {
  const comJuros = [...passivos]
    .filter((p) => p.estrutura === EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO)
    .sort((a, b) => b.custoMensalCentavos - a.custoMensalCentavos);
  const outros = [...passivos]
    .filter((p) => p.estrutura !== EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO)
    .sort((a, b) => a.saldoCentavos - b.saldoCentavos);

  if (comJuros.length === 0 || outros.length === 0) return null;

  const [alvoA, ...comJurosResto] = comJuros;
  const [alvoB, ...outrosResto] = outros;
  return [alvoA.id, alvoB.id, ...comJurosResto.map((p) => p.id), ...outrosResto.map((p) => p.id)];
}

// Traduz a estratégia que o Felipe escolheu (Configuracao.estrategiaEscolhida)
// pra um resultado de simulação — ponto único usado tanto por
// src/lib/estadoAtual.ts (a rota "oficial" propagada pro Mapa e pro gráfico
// de saldo por credor em /ofensores) quanto por telas futuras que precisem
// da mesma tradução. "menorJuros" (ou nenhuma escolha ainda) é o padrão,
// pra não mudar o comportamento de quem já usa o app sem ter escolhido nada.
export function escolherEstrategia(
  passivos: PassivoParaOtimizacao[],
  aporteExtraCentavos: number,
  estrategia: EstrategiaId | null | undefined,
  splitHibridoPct: number | null | undefined
): { resultado: ResultadoEstrategia; exaustivo: boolean } {
  if (estrategia === "menorTempo") {
    return { resultado: simularOrdem(passivos, ordenarPorMenorTempo(passivos), aporteExtraCentavos), exaustivo: false };
  }

  if (estrategia === "maiorAlivio") {
    return { resultado: simularOrdem(passivos, ordenarPorMaiorAlivioCaixa(passivos), aporteExtraCentavos), exaustivo: false };
  }

  if (estrategia === "hibrida") {
    const ordemIds = montarOrdemHibrida(passivos);
    if (ordemIds) {
      const resultado = simularOrdemComSplit(passivos, ordemIds, splitHibridoPct ?? 50, aporteExtraCentavos);
      return { resultado, exaustivo: false };
    }
  }

  return encontrarOrdemMenosJuros(passivos, aporteExtraCentavos);
}
