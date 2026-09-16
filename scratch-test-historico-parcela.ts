// Teste isolado e descartável: confirma que atualizarPassivo agora
// registra em PassivoHistorico quando parcelaAtual/totalParcelas
// mudam (antes desta correção, só valorQuitacaoCentavos/
// custoMensalCentavos eram rastreados) — passivo 100% sintético, sem
// tocar no financiamento real.
import { prisma } from "./src/lib/prisma";
import { atualizarPassivo } from "./src/app/passivos/actions";

async function chamarAction<T>(fn: () => Promise<T>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const digest = (e as { digest?: string })?.digest ?? "";
    if (msg.includes("static generation store missing") || digest.startsWith("NEXT_REDIRECT")) return;
    throw e;
  }
}

async function main() {
  const passivo = await prisma.passivo.create({
    data: {
      nome: "TESTE Passivo Historico Parcela",
      tipo: "teste",
      estrutura: "AMORTIZA_NORMAL",
      valorQuitacaoCentavos: 10_000_00,
      custoMensalCentavos: 500_00,
      parcelaAtual: 5,
      totalParcelas: 100,
    },
  });

  const form = new FormData();
  form.set("nome", passivo.nome);
  form.set("tipo", passivo.tipo);
  form.set("estrutura", passivo.estrutura);
  form.set("valorQuitacao", "10000,00"); // mesmo valor (10_000_00 centavos = R$10.000,00), não deve gerar historico
  form.set("custoMensal", "500,00"); // mesmo valor (500_00 centavos = R$500,00), não deve gerar historico
  form.set("parcelaAtual", "37"); // MUDOU: 5 -> 37
  form.set("totalParcelas", "100"); // não mudou
  form.set("motivo", "TESTE correção de parcela");

  await chamarAction(() => atualizarPassivo(passivo.id, form));

  const depois = await prisma.passivo.findUniqueOrThrow({ where: { id: passivo.id } });
  console.log("parcelaAtual depois:", depois.parcelaAtual);
  if (depois.parcelaAtual !== 37) throw new Error("FALHOU: parcelaAtual não foi atualizado pra 37");

  const historico = await prisma.passivoHistorico.findMany({ where: { passivoId: passivo.id } });
  console.log("linhas de historico:", historico.map((h) => `${h.campo}: ${h.valorAnterior} -> ${h.valorNovo}`));
  if (historico.length !== 1) throw new Error(`FALHOU: esperava 1 linha de histórico (só parcelaAtual mudou), veio ${historico.length}`);
  const linha = historico[0];
  if (linha.campo !== "parcelaAtual" || linha.valorAnterior !== "5" || linha.valorNovo !== "37") {
    throw new Error(`FALHOU: histórico com dados errados: ${JSON.stringify(linha)}`);
  }

  console.log("\nOK: histórico de parcelaAtual registrado corretamente, sem falso positivo nos campos que não mudaram.");

  await prisma.passivoHistorico.deleteMany({ where: { passivoId: passivo.id } });
  await prisma.passivo.delete({ where: { id: passivo.id } });
  console.log("Limpeza concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
