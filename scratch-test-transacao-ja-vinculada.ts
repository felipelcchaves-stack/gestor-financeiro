// Teste isolado e descartável: confirma que a query de transações
// candidatas do "Quitar / Amortizar" agora inclui uma transação JÁ
// vinculada ao próprio passivo (não só passivoId: null) — o bug real
// que o Felipe reportou (Sem Parar/Afinz e Magazine Luiza/Luizacred já
// tinham a transação vinculada antes de esse fluxo existir). Passivo e
// transação 100% sintéticos, sem tocar em dado real.
import { prisma } from "./src/lib/prisma";
import { confirmarPagamentoPassivo } from "./src/app/passivos/actions";

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
      nome: "TESTE Passivo Ja Vinculado",
      tipo: "teste",
      estrutura: "SEM_JUROS",
      valorQuitacaoCentavos: 500_00,
    },
  });
  const transacao = await prisma.transacao.create({
    data: {
      data: new Date(),
      descricao: "TESTE PAG JA VINCULADO",
      valorCentavos: 500_00,
      tipo: "DESPESA",
      origem: "MANUAL",
      passivoId: passivo.id, // já vinculada ANTES de rodar a action, como Sem Parar/Afinz
    },
  });

  // Reproduz exatamente a query nova de src/app/passivos/[id]/page.tsx
  const candidatas = await prisma.transacao.findMany({
    where: { tipo: "DESPESA", ehTransferencia: false, OR: [{ passivoId: null }, { passivoId: passivo.id }] },
  });
  console.log("candidatas encontradas:", candidatas.map((t) => t.descricao));
  if (!candidatas.some((t) => t.id === transacao.id)) {
    throw new Error("FALHOU: transação já vinculada não apareceu na lista de candidatas");
  }

  // Confirma que a query ANTIGA (só passivoId: null) teria perdido essa transação — prova do bug original.
  const candidatasAntigas = await prisma.transacao.findMany({
    where: { tipo: "DESPESA", passivoId: null, ehTransferencia: false, id: transacao.id },
  });
  if (candidatasAntigas.length !== 0) throw new Error("FALHOU: pressuposto do bug original não se confirma");
  console.log("confirmado: query antiga (passivoId: null) realmente não encontrava essa transação.");

  // confirmarPagamentoPassivo deve processar normalmente (quitação total, valor exato).
  const form = new FormData();
  form.set("transacaoId", transacao.id);
  await chamarAction(() => confirmarPagamentoPassivo(passivo.id, form));

  const depois = await prisma.passivo.findUniqueOrThrow({ where: { id: passivo.id } });
  console.log("saldo após confirmar:", depois.valorQuitacaoCentavos, "status:", depois.status);
  if (depois.valorQuitacaoCentavos !== 0) throw new Error("FALHOU: deveria zerar o saldo");
  if (depois.status !== "QUITADO") throw new Error("FALHOU: deveria marcar QUITADO");

  console.log("\nOK: todos os cenários passaram.");

  await prisma.passivoHistorico.deleteMany({ where: { passivoId: passivo.id } });
  await prisma.transacao.delete({ where: { id: transacao.id } });
  await prisma.passivo.delete({ where: { id: passivo.id } });
  console.log("Limpeza concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
