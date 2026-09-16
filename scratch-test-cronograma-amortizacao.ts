// Teste isolado e descartável: confere calcularEstimativaCronograma,
// confirmarPagamentoPassivo e aceitarEstimativaCronograma contra um
// passivo/cronograma/transação 100% sintéticos — sem tocar em nenhum
// dos 6 consignados reais do Felipe.
import { prisma } from "./src/lib/prisma";
import { calcularEstimativaCronograma, proximaParcela } from "./src/lib/cronogramaAmortizacao";
import { confirmarPagamentoPassivo, aceitarEstimativaCronograma } from "./src/app/passivos/actions";

// As actions chamam revalidatePath, que só funciona dentro de uma
// requisição real do Next — fora disso (rodando via tsx) lança
// "Invariant: static generation store missing" DEPOIS de a escrita no
// banco já ter sido concluída. Ignora só esse erro específico pra poder
// testar a lógica de verdade; qualquer outro erro continua propagando.
async function chamarAction<T>(fn: () => Promise<T>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof Error && e.message.includes("static generation store missing")) return;
    throw e;
  }
}

async function main() {
  const passivo = await prisma.passivo.create({
    data: {
      nome: "TESTE Consignado Cronograma",
      tipo: "teste",
      estrutura: "AMORTIZA_NORMAL",
      valorQuitacaoCentavos: 10_000_00,
      custoMensalCentavos: 2_000_00,
      parcelaAtual: 0,
      totalParcelas: 5,
    },
  });

  const hoje = new Date();
  const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  // 5 parcelas: 1 e 2 já venceram (no passado), 3-5 no futuro.
  await prisma.passivoParcelaCronograma.createMany({
    data: [
      { passivoId: passivo.id, numeroParcela: 1, vencimento: diasAtras(60), principalCentavos: 1_500_00, jurosCentavos: 500_00, valorParcelaCentavos: 2_000_00, saldoDevedorCentavos: 999999 },
      { passivoId: passivo.id, numeroParcela: 2, vencimento: diasAtras(30), principalCentavos: 1_600_00, jurosCentavos: 400_00, valorParcelaCentavos: 2_000_00, saldoDevedorCentavos: 999999 },
      { passivoId: passivo.id, numeroParcela: 3, vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), principalCentavos: 1_700_00, jurosCentavos: 300_00, valorParcelaCentavos: 2_000_00, saldoDevedorCentavos: 999999 },
      { passivoId: passivo.id, numeroParcela: 4, vencimento: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), principalCentavos: 1_800_00, jurosCentavos: 200_00, valorParcelaCentavos: 2_000_00, saldoDevedorCentavos: 999999 },
      { passivoId: passivo.id, numeroParcela: 5, vencimento: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), principalCentavos: 3_400_00, jurosCentavos: 0, valorParcelaCentavos: 3_400_00, saldoDevedorCentavos: 0 },
    ],
  });
  const cronograma = await prisma.passivoParcelaCronograma.findMany({ where: { passivoId: passivo.id }, orderBy: { numeroParcela: "asc" } });

  // --- Teste 1: proximaParcela ---
  const prox = proximaParcela(cronograma, 0);
  console.log("proximaParcela(parcelaAtual=0):", prox?.numeroParcela);
  if (prox?.numeroParcela !== 1) throw new Error("FALHOU: próxima parcela deveria ser 1");

  // --- Teste 2: calcularEstimativaCronograma ---
  const estimativa = calcularEstimativaCronograma(cronograma, 0, 10_000_00, hoje);
  console.log("estimativa:", estimativa);
  if (!estimativa) throw new Error("FALHOU: deveria haver estimativa (parcelas 1 e 2 já venceram)");
  if (estimativa.novaParcelaAtual !== 2) throw new Error(`FALHOU: novaParcelaAtual deveria ser 2, veio ${estimativa.novaParcelaAtual}`);
  const principalEsperado = 1_500_00 + 1_600_00;
  if (estimativa.principalAcumuladoCentavos !== principalEsperado) throw new Error("FALHOU: principal acumulado errado");
  if (estimativa.saldoEstimadoCentavos !== 10_000_00 - principalEsperado) throw new Error("FALHOU: saldo estimado errado");

  // --- Teste 3: aceitarEstimativaCronograma grava CONFIABILIDADE ESTIMADO ---
  await chamarAction(() => aceitarEstimativaCronograma(passivo.id));
  const depoisEstimativa = await prisma.passivo.findUniqueOrThrow({ where: { id: passivo.id } });
  console.log("saldo após aceitar estimativa:", depoisEstimativa.valorQuitacaoCentavos, "parcelaAtual:", depoisEstimativa.parcelaAtual);
  if (depoisEstimativa.valorQuitacaoCentavos !== 10_000_00 - principalEsperado) throw new Error("FALHOU: saldo não gravado certo");
  if (depoisEstimativa.parcelaAtual !== 2) throw new Error("FALHOU: parcelaAtual não avançou certo");
  const historicoEstimado = await prisma.passivoHistorico.findFirst({ where: { passivoId: passivo.id }, orderBy: { registradoEm: "desc" } });
  if (historicoEstimado?.confiabilidade !== "ESTIMADO") throw new Error("FALHOU: historico deveria estar marcado ESTIMADO");
  console.log("historico confiabilidade:", historicoEstimado.confiabilidade);

  // --- Teste 4: confirmarPagamentoPassivo com amortização real (parcela 3) ---
  const transacaoAmortizacao = await prisma.transacao.create({
    data: {
      data: new Date(),
      descricao: "TESTE PAG PARCELA 3",
      valorCentavos: 2_000_00, // exatamente o valor da parcela 3 (menor que o saldo restante)
      tipo: "DESPESA",
      origem: "MANUAL",
    },
  });
  const formAmortizar = new FormData();
  formAmortizar.set("transacaoId", transacaoAmortizacao.id);
  await chamarAction(() => confirmarPagamentoPassivo(passivo.id, formAmortizar));
  const depoisAmortizar = await prisma.passivo.findUniqueOrThrow({ where: { id: passivo.id } });
  const saldoEsperadoAmortizar = (10_000_00 - principalEsperado) - 1_700_00; // abate só o Principal da parcela 3
  console.log("saldo após amortizar parcela 3:", depoisAmortizar.valorQuitacaoCentavos, "esperado:", saldoEsperadoAmortizar);
  if (depoisAmortizar.valorQuitacaoCentavos !== saldoEsperadoAmortizar) throw new Error("FALHOU: amortização não abateu só o principal");
  if (depoisAmortizar.parcelaAtual !== 3) throw new Error("FALHOU: parcelaAtual deveria ser 3 após amortizar parcela 3");
  const transacaoVinculada = await prisma.transacao.findUniqueOrThrow({ where: { id: transacaoAmortizacao.id } });
  if (transacaoVinculada.passivoId !== passivo.id) throw new Error("FALHOU: transação não ficou vinculada ao passivo");
  if (depoisAmortizar.status !== "ATIVO") throw new Error("FALHOU: não deveria ter quitado ainda");

  // --- Teste 5: confirmarPagamentoPassivo com quitação total ---
  const transacaoQuitacao = await prisma.transacao.create({
    data: {
      data: new Date(),
      descricao: "TESTE QUITACAO TOTAL",
      valorCentavos: saldoEsperadoAmortizar + 500_00, // mais que o saldo restante
      tipo: "DESPESA",
      origem: "MANUAL",
    },
  });
  const formQuitar = new FormData();
  formQuitar.set("transacaoId", transacaoQuitacao.id);
  await chamarAction(() => confirmarPagamentoPassivo(passivo.id, formQuitar));
  const depoisQuitar = await prisma.passivo.findUniqueOrThrow({ where: { id: passivo.id } });
  console.log("saldo após quitação total:", depoisQuitar.valorQuitacaoCentavos, "status:", depoisQuitar.status);
  if (depoisQuitar.valorQuitacaoCentavos !== 0) throw new Error("FALHOU: quitação total deveria zerar o saldo");
  if (depoisQuitar.status !== "QUITADO") throw new Error("FALHOU: status deveria ser QUITADO");

  console.log("\nOK: todos os cenários passaram.");

  // limpeza
  await prisma.transacao.deleteMany({ where: { id: { in: [transacaoAmortizacao.id, transacaoQuitacao.id] } } });
  await prisma.passivoHistorico.deleteMany({ where: { passivoId: passivo.id } });
  await prisma.passivoParcelaCronograma.deleteMany({ where: { passivoId: passivo.id } });
  await prisma.passivo.delete({ where: { id: passivo.id } });
  console.log("Limpeza concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
