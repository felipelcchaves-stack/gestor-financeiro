// Correção de dado real (não descartável): 6 transações reais estavam
// vinculadas ao passivo errado (mal-classificadas como "Empréstimo
// pessoal Itaú" quando na verdade são parcelas de 3 dos 6 consignados
// — confirmado pelo valor exato bater com a parcela documentada em
// cada PDF) e outras 16 nunca tinham sido vinculadas a nenhum passivo.
// Achado ao comparar um relatório categorizado do Open Finance com o
// banco real (nenhuma transação nova — só vínculos a corrigir).
import { prisma } from "./src/lib/prisma";

const CONSIGNADO_2728846334 = "cmu1b6zd40007thdi9u7drhy0";
const CONSIGNADO_2861406995 = "cmu1b6zdh000rthdiwfa6zjlm";
const CONSIGNADO_2869222998 = "cmu1b6zde000mthdieo918hpv";
const EMPRESTIMO_PESSOAL_ITAU = "cmtu83yta001ftht7ccumy7vc";
const AGIOTA = "cmtu83yt5001atht736q3bysq";

// [transacaoId, novoPassivoId, descricaoEsperada, valorCentavosEsperado]
const CORRECOES: [string, string, string, number][] = [
  // 6 "CREDIARIO AUTOM 01/72"-"06/72" sem vínculo -> Consignado 2728846334
  ["cmtvud2ct01qxth6x1h32lpmm", CONSIGNADO_2728846334, "CREDIARIO AUTOM 01/72", 208507],
  ["cmtvud1y401hhth6xl9wv4usp", CONSIGNADO_2728846334, "CREDIARIO AUTOM 02/72", 208507],
  ["cmtvud19w0179th6x7mkyu0l3", CONSIGNADO_2728846334, "CREDIARIO AUTOM 03/72", 208507],
  ["cmtvud0vs00x9th6xx0zatopi", CONSIGNADO_2728846334, "CREDIARIO AUTOM 04/72", 208507],
  ["cmtvud0hc00pbth6x1oixb20d", CONSIGNADO_2728846334, "CREDIARIO AUTOM 05/72", 208507],
  ["cmtvubigj00ccth6x5w80653h", CONSIGNADO_2728846334, "CREDIARIO AUTOM 06/72", 208507],
  // 2 "CRED INVESTIM" mal-vinculadas ao Empréstimo pessoal Itaú -> Consignado 2728846334
  ["cmtuuftwn009othy5iyf02r2y", CONSIGNADO_2728846334, "CRED INVESTIM", 208507],
  ["cmtutdl7y0002thchj5ksmu2d", CONSIGNADO_2728846334, "CRED INVESTIM", 208507],

  // 1 "CREDIARIO AUTOM 01/72" sem vínculo -> Consignado 2861406995
  ["cmtvubir500n4th6xans0p1uw", CONSIGNADO_2861406995, "CREDIARIO AUTOM 01/72", 148771],
  // 2 "CRED INVESTIM" mal-vinculadas -> Consignado 2861406995
  ["cmtuuftrc006ithy5wt3fjo8j", CONSIGNADO_2861406995, "CRED INVESTIM", 148771],
  ["cmtvubicy00a0th6xop4lcwwq", CONSIGNADO_2861406995, "CRED INVESTIM", 148771],

  // 1 "CREDIARIO AUTOM 01/72" sem vínculo -> Consignado 2869222998
  ["cmtvubiod00jyth6xo19b48vf", CONSIGNADO_2869222998, "CREDIARIO AUTOM 01/72", 214658],
  // 2 "CRED INVESTIM" mal-vinculadas -> Consignado 2869222998
  ["cmtuuftnt003sthy50fywqy44", CONSIGNADO_2869222998, "CRED INVESTIM", 214658],
  ["cmtvubi9r007gth6xpftrbawf", CONSIGNADO_2869222998, "CRED INVESTIM", 214658],

  // 8 "CREDIARIO AUTOM" (R$1.888,11) sem vínculo -> Empréstimo pessoal Itaú
  ["cmtvud2ko01vrth6xc9zcevq2", EMPRESTIMO_PESSOAL_ITAU, "CREDIARIO AUTOM 22/60", 188811],
  ["cmtvud22d01kjth6xim4uefgx", EMPRESTIMO_PESSOAL_ITAU, "CREDIARIO AUTOM 23/60", 188811],
  ["cmtvud1r901cvth6xr2lypew1", EMPRESTIMO_PESSOAL_ITAU, "CREDIARIO AUTOM 24/60", 188811],
  ["cmtvud12i011xth6x80ntb6m8", EMPRESTIMO_PESSOAL_ITAU, "CREDIARIO AUTOM 25/60", 188811],
  ["cmtvud0oi00u9th6xy0qdp7kl", EMPRESTIMO_PESSOAL_ITAU, "CREDIARIO AUTOM 26/60", 188811],
  ["cmtvubin400iqth6xmpyxwpy6", EMPRESTIMO_PESSOAL_ITAU, "CREDIARIO AUTOM 27/60", 188811],
  ["cmtvubi8j0066th6x3wk7ppp5", EMPRESTIMO_PESSOAL_ITAU, "CREDIARIO AUTOM", 188811],
  ["cmtuuftma0038thy513iurm3m", EMPRESTIMO_PESSOAL_ITAU, "CREDIARIO AUTOM", 188811],

  // PIX do mês corrente sem vínculo -> Agiota
  ["cmtxitf53000ith3d3xyi7lxy", AGIOTA, "PIX TRANSF 67 858 11/09", 2250000],
];

async function main() {
  // Confere saldo documentado dos 3 consignados + Empréstimo pessoal Itaú
  // ANTES da correção, pra comparar depois e confirmar que os 3
  // consignados não mudam (só o vínculo, nada de saldo).
  const idsPassivos = [CONSIGNADO_2728846334, CONSIGNADO_2861406995, CONSIGNADO_2869222998, EMPRESTIMO_PESSOAL_ITAU, AGIOTA];
  const antes = await prisma.passivo.findMany({ where: { id: { in: idsPassivos } }, select: { id: true, nome: true, valorQuitacaoCentavos: true } });
  console.log("Saldo ANTES:");
  antes.forEach((p) => console.log(`  ${p.nome}: R$${(p.valorQuitacaoCentavos! / 100).toFixed(2)}`));

  for (const [transacaoId, , descricaoEsperada, valorEsperado] of CORRECOES) {
    const t = await prisma.transacao.findUniqueOrThrow({ where: { id: transacaoId } });
    if (t.valorCentavos !== valorEsperado || !t.descricao.includes(descricaoEsperada.split(" ")[0])) {
      throw new Error(`Transação ${transacaoId} não bate com o esperado: ${t.descricao} / ${t.valorCentavos} (esperava ${descricaoEsperada} / ${valorEsperado})`);
    }
  }

  await prisma.$transaction(
    CORRECOES.map(([transacaoId, novoPassivoId]) =>
      prisma.transacao.update({ where: { id: transacaoId }, data: { passivoId: novoPassivoId, ativoId: null } })
    )
  );

  console.log(`\n${CORRECOES.length} transações religadas/vinculadas com sucesso.`);

  const depois = await prisma.passivo.findMany({ where: { id: { in: idsPassivos } }, select: { id: true, nome: true, valorQuitacaoCentavos: true } });
  console.log("\nSaldo DEPOIS (deve ser idêntico ao ANTES em todos — a correção só mexe em vínculo, nunca em saldo):");
  depois.forEach((p) => console.log(`  ${p.nome}: R$${(p.valorQuitacaoCentavos! / 100).toFixed(2)}`));

  for (const p of antes) {
    const d = depois.find((x) => x.id === p.id)!;
    if (d.valorQuitacaoCentavos !== p.valorQuitacaoCentavos) {
      throw new Error(`ALERTA: saldo de ${p.nome} mudou de ${p.valorQuitacaoCentavos} para ${d.valorQuitacaoCentavos} — não deveria!`);
    }
  }
  console.log("\nConfirmado: nenhum saldo documentado mudou (só vínculo, como esperado).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
