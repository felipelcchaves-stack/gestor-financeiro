// Seed com a posição consolidada da auditoria financeira (seção 6 do PRD).
// Data de referência: 09/09/2026. Valores marcados como ESTIMADO no PRD
// mantêm essa marcação aqui via `confiabilidade` ou `observacao`.

import {
  PrismaClient,
  EstruturaPassivo,
  TipoConta,
  TipoTransacao,
  FrequenciaRecorrencia,
  Confiabilidade,
} from "../src/generated/prisma";

const prisma = new PrismaClient();

function centavos(reais: number): number {
  return Math.round(reais * 100);
}

async function limparBanco() {
  await prisma.alocacaoMeta.deleteMany();
  await prisma.metaPassivo.deleteMany();
  await prisma.meta.deleteMany();
  await prisma.regraClassificacao.deleteMany();
  await prisma.recorrenciaFinanceira.deleteMany();
  await prisma.transacao.deleteMany();
  await prisma.ativoPassivoVinculo.deleteMany();
  await prisma.ativoHistorico.deleteMany();
  await prisma.ativo.deleteMany();
  await prisma.passivoHistorico.deleteMany();
  await prisma.cicloFaturaPassivo.deleteMany();
  await prisma.passivo.deleteMany();
  await prisma.orcamentoCategoria.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.conta.deleteMany();
  await prisma.documento.deleteMany();
}

async function main() {
  await limparBanco();

  // --- Categorias ---------------------------------------------------------
  const [
    moradia,
    saude,
    utilidades,
    seguros,
    emprestimo,
    cartao,
    dividaHonra,
    religiaoReceita,
    ,
    renda,
  ] = await Promise.all(
    [
      "Moradia",
      "Saúde",
      "Utilidades",
      "Seguros",
      "Empréstimo",
      "Cartão de Crédito",
      "Dívida de Honra",
      "Religião - Receita",
      "Religião - Despesa",
      "Renda",
    ].map((nome) => prisma.categoria.create({ data: { nome } }))
  );

  const subEmprestimo = Object.fromEntries(
    await Promise.all(
      [
        "Agiota",
        "Leka 1",
        "Leka 2",
        "Consignado Itaú",
        "Empréstimo Pessoal Itaú",
        "Nubank Empréstimo Pessoal",
        "Nubank Capital de Giro",
        "Financiamento Esmeraldina",
      ].map(async (nome) => [
        nome,
        await prisma.categoria.create({ data: { nome, parentId: emprestimo.id } }),
      ])
    )
  );

  const subCartao = Object.fromEntries(
    await Promise.all(
      [
        "Itaú Personnalité Black",
        "Itaú Personnalité Visa Infinite",
        "Itaú Uniclass Black",
        "Magazine Luiza/Luizacred",
        "Mercado Pago",
        "Sem Parar/Afinz",
      ].map(async (nome) => [
        nome,
        await prisma.categoria.create({ data: { nome, parentId: cartao.id } }),
      ])
    )
  );

  const oluwoCategoria = await prisma.categoria.create({
    data: { nome: "Oluwo", parentId: dividaHonra.id },
  });

  const [salarioCategoria, cursosCategoria] = await Promise.all([
    prisma.categoria.create({ data: { nome: "Salário/Pró-labore", parentId: renda.id } }),
    prisma.categoria.create({ data: { nome: "Cursos Online", parentId: renda.id } }),
  ]);

  // --- Contas ---------------------------------------------------------------
  const contaPF = await prisma.conta.create({
    data: {
      nome: "Conta Corrente Itaú (PF)",
      tipo: TipoConta.CORRENTE_PF,
      limiteChequeEspecialCentavos: centavos(30852.0),
      taxaJurosChequeEspecialPct: 8,
      carenciaDiasChequeEspecial: 10,
    },
  });

  await prisma.conta.create({
    data: {
      nome: "Conta PJ (Fcchaves)",
      tipo: TipoConta.CORRENTE_PJ,
    },
  });

  // --- Passivos com sangria mensal ativa -------------------------------------
  await prisma.passivo.create({
    data: {
      nome: "Agiota",
      tipo: "agiota",
      valorQuitacaoCentavos: centavos(172500.0),
      custoMensalCentavos: centavos(22500.0),
      estrutura: EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO,
      taxaJurosPct: 15,
      observacao:
        "Binário: paga tudo ou continua pagando juros. Taxa informada 15%/mês não reconciliada com o custo mensal — diferença de R$3.375,00 ainda em aberto.",
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Leka 1",
      tipo: "emprestimo-informal",
      valorQuitacaoCentavos: centavos(173921.8),
      custoMensalCentavos: centavos(8326.94),
      estrutura: EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO,
      observacao:
        "Sem amortização. Confirmado por Felipe — bate exatamente com o valor calculado por diferença (R$12.433,06 − R$4.106,12).",
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Leka 2",
      tipo: "emprestimo-informal",
      valorQuitacaoCentavos: centavos(127708.03),
      custoMensalCentavos: centavos(4106.12),
      estrutura: EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO,
      observacao: "Sem amortização. Confirmado por Felipe.",
    },
  });

  // --- Passivo sem sangria mensal ---------------------------------------------
  await prisma.passivo.create({
    data: {
      nome: "Oluwo (Thomas Ayoola)",
      tipo: "divida-honra",
      valorQuitacaoCentavos: centavos(165000.0),
      estrutura: EstruturaPassivo.SEM_JUROS,
      observacao: "Dívida de honra, sem juros, pagamento flexível no ritmo de Felipe.",
    },
  });

  // --- Passivos formais (bancários) --------------------------------------------
  await prisma.passivo.create({
    data: {
      nome: "6 consignados Itaú (garantia CDB)",
      tipo: "consignado",
      valorQuitacaoCentavos: centavos(466190.28),
      custoMensalCentavos: centavos(13499.63),
      estrutura: EstruturaPassivo.AMORTIZA_NORMAL,
      observacao: "Debita da conta corrente, não do CDB.",
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Empréstimo pessoal Itaú",
      tipo: "emprestimo-pessoal",
      valorQuitacaoCentavos: centavos(41538.42),
      custoMensalCentavos: centavos(1888.11),
      estrutura: EstruturaPassivo.AMORTIZA_NORMAL,
      observacao: "Quitação antecipada disponível por R$30.769,47.",
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Nubank Empréstimo Pessoal",
      tipo: "emprestimo-pessoal",
      custoMensalCentavos: centavos(1923.21),
      estrutura: EstruturaPassivo.AMORTIZA_NORMAL,
      parcelaAtual: 7,
      totalParcelas: 48,
      observacao: "Saldo devedor total não documentado; apenas parcela e progresso confirmados.",
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Nubank Capital de Giro (PJ Fcchaves)",
      tipo: "capital-de-giro",
      custoMensalCentavos: centavos(2991.12),
      estrutura: EstruturaPassivo.AMORTIZA_NORMAL,
      parcelaAtual: 10,
      totalParcelas: 24,
      observacao: "Saldo devedor total não documentado; apenas parcela e progresso confirmados.",
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Financiamento Esmeraldina/Caixa",
      tipo: "financiamento",
      custoMensalCentavos: centavos(2493.33),
      estrutura: EstruturaPassivo.AMORTIZA_NORMAL,
      observacao: "Valor mensal aproximado (~). Inclui seguro obrigatório. Saldo devedor total não documentado.",
    },
  });

  // --- Cartões de crédito -------------------------------------------------------
  await prisma.passivo.create({
    data: {
      nome: "Itaú Personnalité Black (3907/1443)",
      tipo: "cartao",
      valorQuitacaoCentavos: centavos(56374.62),
      custoMensalVariavel: true,
      estrutura: EstruturaPassivo.SEM_JUROS,
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Itaú Personnalité Visa Infinite (4831/4766)",
      tipo: "cartao",
      custoMensalVariavel: true,
      estrutura: EstruturaPassivo.SEM_JUROS,
      observacao: "Ver fatura mais recente — valor ainda não importado.",
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Itaú Uniclass Black (5536/7079)",
      tipo: "cartao",
      custoMensalVariavel: true,
      estrutura: EstruturaPassivo.SEM_JUROS,
      observacao: "Ver fatura mais recente — valor ainda não importado.",
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Magazine Luiza/Luizacred",
      tipo: "cartao",
      valorQuitacaoCentavos: centavos(1240.58),
      custoMensalVariavel: true,
      estrutura: EstruturaPassivo.SEM_JUROS,
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Mercado Pago",
      tipo: "cartao",
      custoMensalVariavel: true,
      estrutura: EstruturaPassivo.SEM_JUROS,
      observacao: "Documentado; mínimo mensal ainda não confirmado.",
    },
  });

  await prisma.passivo.create({
    data: {
      nome: "Sem Parar/Afinz",
      tipo: "cartao",
      valorQuitacaoCentavos: centavos(5229.3),
      custoMensalVariavel: true,
      estrutura: EstruturaPassivo.SEM_JUROS,
      observacao: "CPF/nome divergente no documento — não totalmente explicado.",
    },
  });

  // --- Ativos --------------------------------------------------------------
  const consignados = await prisma.passivo.findFirstOrThrow({
    where: { nome: "6 consignados Itaú (garantia CDB)" },
  });

  const cdb = await prisma.ativo.create({
    data: {
      nome: 'CDB "Privilege"',
      valorCentavos: centavos(440497.05),
      liquidez: "D+0",
      observacao: "Referência inicial. Resgatar reduz a garantia dos consignados.",
    },
  });

  await prisma.ativoPassivoVinculo.create({
    data: {
      ativoId: cdb.id,
      passivoId: consignados.id,
      tipoVinculo: "GARANTIA",
    },
  });

  // --- Despesas recorrentes --------------------------------------------------
  await prisma.recorrenciaFinanceira.createMany({
    data: [
      {
        nome: "Aluguel (Potiguara)",
        tipo: TipoTransacao.DESPESA,
        valorCentavos: centavos(4762.0),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: moradia.id,
        observacao: "Temporário — previsão de 2-3 meses até concluir obra do templo e liberar carência de saída.",
      },
      {
        nome: "Condomínio (Potiguara)",
        tipo: TipoTransacao.DESPESA,
        valorCentavos: centavos(1843.09),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: moradia.id,
        observacao: "Mesmo prazo do aluguel.",
      },
      {
        nome: "Plano de saúde (Felipe + esposa)",
        tipo: TipoTransacao.DESPESA,
        valorCentavos: centavos(3368.56),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: saude.id,
      },
      {
        nome: "Plano de saúde (mãe)",
        tipo: TipoTransacao.DESPESA,
        valorCentavos: centavos(1921.91),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.ESTIMADO,
        categoriaId: saude.id,
        observacao:
          "Calculado por diferença — R$14.354,97 (PIX ALEKSAN total) − R$8.326,94 (Leka 1) − R$4.106,12 (Leka 2), confere exatamente; ainda não confirmado por documento isolado. Embutido no pagamento combinado com Leka.",
      },
      {
        nome: "Claro (internet/telefone)",
        tipo: TipoTransacao.DESPESA,
        valorCentavos: centavos(303.66),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: utilidades.id,
      },
      {
        nome: "Claro Celular",
        tipo: TipoTransacao.DESPESA,
        valorCentavos: centavos(179.04),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: utilidades.id,
      },
      {
        nome: "Ceg-gás",
        tipo: TipoTransacao.DESPESA,
        valorCentavos: centavos(241.49),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: utilidades.id,
        observacao: "Valor varia mês a mês.",
      },
      {
        nome: "Proteção familiar",
        tipo: TipoTransacao.DESPESA,
        valorCentavos: centavos(101.75),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: seguros.id,
      },
      {
        nome: "Porto Seguro",
        tipo: TipoTransacao.DESPESA,
        valorCentavos: centavos(97.3),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: seguros.id,
        observacao: "Débito recorrente visto em extrato.",
      },
      // --- Receitas ---
      {
        nome: "Salário/pagamento (conta PJ)",
        tipo: TipoTransacao.ENTRADA,
        valorCentavos: centavos(18000.0),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: salarioCategoria.id,
        observacao: "Recorrência mensal é fato confirmado; valor exato pode variar conforme horas trabalhadas.",
      },
      {
        nome: "Religião — baseline histórico",
        tipo: TipoTransacao.ENTRADA,
        valorCentavos: centavos(25000.0),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.ESTIMADO,
        categoriaId: religiaoReceita.id,
      },
      {
        nome: "Religião — sazonal adicional (setembro)",
        tipo: TipoTransacao.ENTRADA,
        valorCentavos: centavos(70000.0),
        frequencia: FrequenciaRecorrencia.UNICA,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: religiaoReceita.id,
        observacao: "Declarado como certo.",
      },
      {
        nome: "Religião — campanha específica pró-Agiota (setembro)",
        tipo: TipoTransacao.ENTRADA,
        valorCentavos: centavos(127500.0),
        frequencia: FrequenciaRecorrencia.UNICA,
        confiabilidade: Confiabilidade.ESTIMADO,
        categoriaId: religiaoReceita.id,
        observacao: "Estimado, baixa precisão. Earmarked para a meta de quitação do Agiota.",
      },
      {
        nome: "Cursos online (30+ cursos)",
        tipo: TipoTransacao.ENTRADA,
        valorCentavos: centavos(25000.0),
        frequencia: FrequenciaRecorrencia.MENSAL,
        confiabilidade: Confiabilidade.CONFIRMADO,
        categoriaId: cursosCategoria.id,
        observacao: "Declarado como certo.",
      },
    ],
  });

  // --- Meta ativa nº 1 ---------------------------------------------------------
  const agiota = await prisma.passivo.findFirstOrThrow({ where: { nome: "Agiota" } });

  await prisma.meta.create({
    data: {
      nome: "Zerar Agiota",
      valorAlvoCentavos: centavos(172500.0),
      dataAlvo: new Date("2026-09-30"),
      passivosAlvo: { create: [{ passivoId: agiota.id }] },
    },
  });

  console.log("Seed concluído.");
  console.log({
    categorias: {
      raiz: 10,
      emprestimo: Object.keys(subEmprestimo).length,
      cartao: Object.keys(subCartao).length,
    },
    oluwoCategoria: oluwoCategoria.nome,
    contaPF: contaPF.nome,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
