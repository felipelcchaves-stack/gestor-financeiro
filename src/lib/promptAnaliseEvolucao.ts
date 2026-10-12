// Monta o prompt da análise de evolução mensal (botão no Mapa,
// src/app/(mapa)/page.tsx) e o schema de saída estruturada — mesmo
// mecanismo de tool-use forçado já usado em SUGESTAO_CORTE_SCHEMA
// (src/lib/promptCorteDeGastos.ts), trocado de texto corrido pra
// campos separados (tendência / ações prioritárias / pontos de
// atenção com dica / pontos positivos) porque um parágrafo único
// misturando tudo ficava difícil de escanear e não dava pra pedir uma
// dica por ponto de atenção sem virar mais um parágrafo solto.
// Reaproveita listarDespesasPorCategoria (src/lib/promptCorteDeGastos.ts)
// só pro contexto do mês atual, sem duplicar essa formatação.

import { formatarBRL } from "@/lib/money";
import type { PontoEvolucaoMensal, MovimentacaoDoMes } from "@/lib/ofensores";
import { listarDespesasPorCategoria } from "@/lib/promptCorteDeGastos";
import type { EstadoAtual } from "@/lib/estadoAtual";
import type { StatusRateio } from "@/lib/rateio";

export type PontoAtencaoEvolucao = { item: string; dica: string };

export type AnaliseEvolucaoEstruturada = {
  tendencia: string;
  acoesPrioritarias: string[];
  pontosAtencao: PontoAtencaoEvolucao[];
  pontosPositivos: string[];
};

// JSON Schema — usado como `input_schema` de uma tool forçada na API
// do Claude (src/lib/claude.ts), mesmo padrão de SUGESTAO_CORTE_SCHEMA.
export const ANALISE_EVOLUCAO_SCHEMA = {
  type: "object",
  properties: {
    tendencia: {
      type: "string",
      description:
        "1-2 parágrafos em português dizendo, de forma explícita, se a pessoa está no caminho certo ou não — baseado principalmente em como a dívida total documentada evoluiu (seção 'Dívida total documentada') e se ela está pagando dívida de verdade (pagamentos vinculados a passivo, transferências pra reserva), não só na oscilação mês a mês do saldo de caixa. Cite meses e valores reais. O mês marcado (PROJETADO), se houver, nunca deve ser citado aqui como fato consumado — só como expectativa.",
    },
    acoesPrioritarias: {
      type: "array",
      items: { type: "string" },
      description:
        "Até 4 ações práticas e específicas pra melhorar a gestão daqui pra frente, em ordem de prioridade (a primeira é a mais urgente). Só em categorias não protegidas. Cada item é uma frase curta e direta, sem numeração no próprio texto (ex: 'Congelar novos gastos no cartão X').",
    },
    pontosAtencao: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: {
            type: "string",
            description:
              "Um gasto, categoria ou padrão preocupante identificado nos dados (frase curta) — OU um lançamento/número que parece destoante, possivelmente mal classificado, ou grande demais pra passar batido sem conferir.",
          },
          dica: {
            type: "string",
            description:
              "Uma dica prática de como melhorar esse ponto, OU, se o item for um dado suspeito, um pedido direto pra conferir/confirmar aquele lançamento específico (nunca afirme que está errado com certeza, já que só o Felipe sabe o que realmente aconteceu).",
          },
        },
        required: ["item", "dica"],
      },
      description:
        "Pontos de atenção reais nos dados (gasto alto, categoria crescendo, saldo negativo etc) E suspeitas de dado errado (classificação estranha, valor isolado muito fora do padrão dos outros meses) — cada um já com sua dica ou pedido de confirmação.",
    },
    pontosPositivos: {
      type: "array",
      items: { type: "string" },
      description:
        "Pontos genuinamente positivos identificados nos dados — inclua explicitamente quando a dívida total caiu, quando um mês teve pagamento de dívida relevante, ou quando dinheiro foi movido pra reserva/cofre, além de coisas como mês com saldo positivo ou categoria que caiu. Se não houver nenhum de verdade, devolva um array vazio — nunca invente um ponto positivo só pra preencher.",
    },
  },
  required: ["tendencia", "acoesPrioritarias", "pontosAtencao", "pontosPositivos"],
};

function nomeMes(mes: string): string {
  const [ano, mesNum] = mes.split("-").map(Number);
  return new Date(ano, mesNum - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function gerarPromptAnaliseEvolucao(
  pontos: PontoEvolucaoMensal[],
  estado: EstadoAtual,
  movimentacaoDoMesAtual: MovimentacaoDoMes,
  movimentacaoDoMesAnterior: MovimentacaoDoMes | null,
  statusRateio: StatusRateio | null
): string {
  const linhas: string[] = [];

  linhas.push(
    "Você é um consultor financeiro pessoal especializado em saída de dívida. Analise os dados abaixo (já calculados — não invente nem recalcule) e diga claramente se a pessoa está no caminho certo pra sair das dívidas, considerando a dívida total caindo, pagamento de dívida e dinheiro guardado pra esse fim — não só a oscilação de caixa mês a mês."
  );
  linhas.push("");

  linhas.push("## Dívida total documentada");
  linhas.push(`Hoje: ${formatarBRL(estado.passivoTotal)}.`);
  const snapshotsOrdenados = [...estado.snapshots].sort((a, b) => a.mesReferencia.localeCompare(b.mesReferencia));
  const maisAntigo = snapshotsOrdenados[0];
  if (maisAntigo && maisAntigo.passivoTotalCentavos !== estado.passivoTotal) {
    const variacao = estado.passivoTotal - maisAntigo.passivoTotalCentavos;
    const direcao = variacao <= 0 ? "reduziu" : "aumentou";
    linhas.push(
      `Em ${nomeMes(maisAntigo.mesReferencia)}, o registro mais antigo, a dívida total era ${formatarBRL(maisAntigo.passivoTotalCentavos)} — desde então ${direcao} ${formatarBRL(Math.abs(variacao))}.`
    );
  }
  linhas.push(
    "Esse número é o sinal mais confiável de progresso real — mais importante do que a oscilação de caixa de um mês isolado."
  );
  linhas.push("");

  linhas.push("## Dívidas ativas hoje (nenhuma listada aqui está sem pagamento — só as quitadas somem da lista)");
  if (estado.passivosAtivos.length === 0) {
    linhas.push("Nenhuma dívida ativa cadastrada.");
  } else {
    for (const p of estado.passivosAtivos) {
      linhas.push(
        `- ${p.nome}: ${p.valorQuitacaoCentavos != null ? formatarBRL(p.valorQuitacaoCentavos) : "saldo não documentado"}`
      );
    }
  }
  linhas.push("");

  linhas.push("## Reserva/Cofre (separação automática de receita pra juntar dinheiro e quitar dívida)");
  if (statusRateio) {
    linhas.push(
      `${statusRateio.percentual}% da receita de "${statusRateio.categoriaNome}" é separado pra "${statusRateio.contaDestinoNome}" desde ${nomeMes(statusRateio.ativoDesde.toISOString().slice(0, 7))}.`
    );
    linhas.push(
      `Já foram separados ${formatarBRL(statusRateio.totalDepositadoCentavos)} de uma meta de ${formatarBRL(statusRateio.metaSepararCentavos)} (falta ${formatarBRL(statusRateio.faltaSepararCentavos)}).`
    );
    if (statusRateio.dividaQuitavel) {
      linhas.push(
        `O saldo já reservado dá pra quitar "${statusRateio.dividaQuitavel.nome}" (${formatarBRL(statusRateio.dividaQuitavel.valorQuitacaoCentavos)}) inteira agora.`
      );
    }
  } else {
    linhas.push("Nenhuma separação automática configurada ainda.");
  }
  linhas.push("");

  linhas.push("## Gasto por categoria: este mês x mês anterior (ex: cartão de crédito caindo é progresso real)");
  const categoriasAtuais = new Map(movimentacaoDoMesAtual.despesasPorCategoria.map((c) => [c.id, c]));
  const categoriasAnteriores = new Map((movimentacaoDoMesAnterior?.despesasPorCategoria ?? []).map((c) => [c.id, c]));
  if (!movimentacaoDoMesAnterior || (categoriasAtuais.size === 0 && categoriasAnteriores.size === 0)) {
    linhas.push("Sem dado do mês anterior pra comparar ainda.");
  } else {
    const idsCombinados = new Set([...categoriasAtuais.keys(), ...categoriasAnteriores.keys()]);
    const comparacoes = Array.from(idsCombinados).map((id) => {
      const atual = categoriasAtuais.get(id);
      const anterior = categoriasAnteriores.get(id);
      return { nome: (atual ?? anterior)!.nome, atualCentavos: atual?.totalCentavos ?? 0, anteriorCentavos: anterior?.totalCentavos ?? 0 };
    });
    comparacoes.sort((a, b) => Math.abs(b.atualCentavos - b.anteriorCentavos) - Math.abs(a.atualCentavos - a.anteriorCentavos));
    for (const c of comparacoes) {
      const delta = c.atualCentavos - c.anteriorCentavos;
      const direcao = delta < 0 ? "CAIU" : delta > 0 ? "subiu" : "igual";
      linhas.push(
        `- ${c.nome}: mês anterior ${formatarBRL(c.anteriorCentavos)} → este mês ${formatarBRL(c.atualCentavos)} (${direcao} ${formatarBRL(Math.abs(delta))})`
      );
    }
  }
  linhas.push("");

  linhas.push("## Entradas x despesas por mês (histórico completo importado)");
  for (const p of pontos) {
    const saldo = p.entradasCentavos - p.despesasCentavos;
    const detalheDespesas =
      p.pagoDividasCentavos > 0
        ? ` (das quais ${formatarBRL(p.pagoDividasCentavos)} foram pagamento de dívida — isso ABATE quanto você deve, não é gasto descontrolado)`
        : "";
    const detalheTransferencia =
      p.transferidoReservaCentavos > 0
        ? `, movido pra reserva/outra conta: ${formatarBRL(p.transferidoReservaCentavos)} (dinheiro guardado de propósito, normalmente visando quitar dívida depois — não é gasto)`
        : "";
    const marcadorProjetado = p.projetado
      ? " (PROJETADO — calculado a partir de renda e despesa recorrente, parcela mínima de dívida e parcelas de compras já parceladas no cartão com cobrança sabida pra esse mês, todas já cadastradas/documentadas no sistema; ainda não é fato, ninguém fechou esse mês)"
      : "";
    linhas.push(
      `- ${nomeMes(p.mes)}: entradas ${formatarBRL(p.entradasCentavos)}, despesas ${formatarBRL(p.despesasCentavos)}${detalheDespesas}${detalheTransferencia}, saldo ${formatarBRL(saldo)}${marcadorProjetado}`
    );
  }
  linhas.push("");

  if (pontos.some((p) => p.projetado)) {
    linhas.push(
      "IMPORTANTE: o mês marcado (PROJETADO) acima é uma estimativa, não um fato consumado — NUNCA fale dele como algo que já aconteceu, já foi fechado ou já está garantido. Trate-o sempre como expectativa (ex: \"a projeção para o próximo mês indica...\") e não o misture com os meses reais ao descrever a tendência observada até aqui."
    );
    linhas.push("");
  }

  linhas.push(`## Despesas do mês mais recente por categoria (total: ${formatarBRL(movimentacaoDoMesAtual.despesasTotalCentavos)})`);
  linhas.push(...listarDespesasPorCategoria(movimentacaoDoMesAtual));
  linhas.push("");

  linhas.push(
    "IMPORTANTE: categorias marcadas (PROTEGIDA) são fixas (ex: aluguel de onde mora) ou já tratadas por outro caminho (ex: já é o custo de uma dívida na rota de otimização) — NUNCA sugira cortar, renegociar, reduzir ou eliminar uma delas, mesmo de forma genérica ou como parte de uma lista maior, nem em `acoesPrioritarias` nem em `pontosAtencao`. Se for citar uma categoria protegida, é só pra contextualizar o total gasto, nunca como uma ação recomendada."
  );
  linhas.push("");

  linhas.push(
    "IMPORTANTE: pagamento de dívida (valor entre parênteses em cada mês) e dinheiro movido pra reserva/outra conta são SINAIS POSITIVOS de organização financeira — nunca descreva isso como \"gasto descontrolado\", \"déficit\" ou \"volatilidade preocupante\". Um mês com despesa alta majoritariamente por pagamento de dívida, mesmo com saldo negativo naquele mês, é bom sinal, não ruim. O indicador mais importante pra dizer se a pessoa está no caminho certo é a dívida total caindo ao longo do tempo (seção acima) e nenhuma dívida ativa ficando sem pagamento — não a oscilação mês a mês do saldo de caixa."
  );
  linhas.push("");

  linhas.push(
    "IMPORTANTE: use a seção 'Gasto por categoria: este mês x mês anterior' pra citar explicitamente toda categoria que CAIU (principalmente cartão de crédito e empréstimo, que costumam ser as maiores) — isso é redução real de gasto/dívida e deve aparecer em `pontosPositivos`, não ser ignorado. Só trate uma categoria como ponto de atenção se ela SUBIU de verdade mês a mês, nunca pelo valor absoluto isolado."
  );
  linhas.push("");

  linhas.push(
    "IMPORTANTE: se algum número destoar muito do padrão dos outros meses (um valor isolado muito alto, uma categoria que nunca apareceu antes, um total que não bate com o resto da série) ou parecer uma classificação errada, não trate isso como fato consumado nem ignore — liste em `pontosAtencao` pedindo pra Felipe conferir/confirmar aquele lançamento específico. Nunca afirme com certeza que algo está errado (só ele sabe o que de fato aconteceu); peça confirmação, não acuse."
  );
  linhas.push("");

  linhas.push("Responda preenchendo os campos pedidos: `tendencia`, `acoesPrioritarias`, `pontosAtencao` (cada um com `item` e `dica`) e `pontosPositivos`.");

  return linhas.join("\n");
}

// JSON.parse + validação de formato da resposta do Claude, e filtro
// defensivo: remove qualquer ação prioritária ou ponto de atenção cujo
// texto mencione (case-insensitive, substring — aqui são frases
// livres, não um nome exato de categoria) uma categoria protegida,
// caso o modelo ignore a instrução do prompt. Já aconteceu de verdade
// nessa mesma função antes (a resposta citou "Esmeraldino", uma
// categoria protegida) quando a saída era texto livre sem como
// filtrar — com campos estruturados dá pra filtrar de verdade, mesmo
// espírito de parseSugestaoCorte (src/lib/promptCorteDeGastos.ts).
export function parseAnaliseEvolucao(textoJson: string, protegidos: Set<string>): AnaliseEvolucaoEstruturada {
  let dados: unknown;
  try {
    dados = JSON.parse(textoJson);
  } catch {
    throw new Error("Resposta do Claude veio num formato inesperado (não é JSON válido) — tente de novo.");
  }

  if (
    typeof dados !== "object" ||
    dados === null ||
    typeof (dados as Record<string, unknown>).tendencia !== "string" ||
    !Array.isArray((dados as Record<string, unknown>).acoesPrioritarias) ||
    !Array.isArray((dados as Record<string, unknown>).pontosAtencao) ||
    !Array.isArray((dados as Record<string, unknown>).pontosPositivos)
  ) {
    throw new Error("Resposta do Claude veio sem o formato esperado — tente de novo.");
  }

  const bruto = dados as {
    tendencia: string;
    acoesPrioritarias: unknown[];
    pontosAtencao: unknown[];
    pontosPositivos: unknown[];
  };

  const mencionaProtegida = (texto: string) => {
    const minusculo = texto.toLowerCase();
    for (const nome of protegidos) {
      if (minusculo.includes(nome)) return true;
    }
    return false;
  };

  const acoesPrioritarias = bruto.acoesPrioritarias
    .filter((a): a is string => typeof a === "string")
    .filter((a) => !mencionaProtegida(a));

  const pontosAtencao = bruto.pontosAtencao
    .filter(
      (p): p is { item: string; dica: string } =>
        typeof p === "object" && p !== null && typeof (p as Record<string, unknown>).item === "string" && typeof (p as Record<string, unknown>).dica === "string"
    )
    .filter((p) => !mencionaProtegida(p.item));

  const pontosPositivos = bruto.pontosPositivos.filter((p): p is string => typeof p === "string");

  return { tendencia: bruto.tendencia, acoesPrioritarias, pontosAtencao, pontosPositivos };
}
