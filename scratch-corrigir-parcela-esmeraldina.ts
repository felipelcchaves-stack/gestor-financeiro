// Correção de dado real (não descartável): o Financiamento
// Esmeraldina/Caixa estava cadastrado com parcelaAtual: 2, mas o
// contrato real já está na parcela 28 (totalParcelas: 240 continua
// certo, mesmo contrato). A action de edição hoje não registrava
// mudança de parcelaAtual em PassivoHistorico (corrigido em
// src/app/passivos/actions.ts nesta mesma leva), então essa correção
// de 26 parcelas precisa do registro manual pra não passar sem rastro.
import { prisma } from "./src/lib/prisma";

const PASSIVO_ID = "cmtu83ytd001itht7rgf3yjlh";

async function main() {
  const passivo = await prisma.passivo.findUniqueOrThrow({ where: { id: PASSIVO_ID } });
  console.log(`Antes: ${passivo.nome} — parcelaAtual ${passivo.parcelaAtual}/${passivo.totalParcelas}`);
  if (passivo.nome !== "Financiamento Esmeraldina/Caixa") {
    throw new Error(`Passivo inesperado: ${passivo.nome} (esperava Financiamento Esmeraldina/Caixa)`);
  }
  if (passivo.totalParcelas !== 240) {
    throw new Error(`totalParcelas inesperado: ${passivo.totalParcelas} (esperava 240, não mexer se mudou)`);
  }

  await prisma.$transaction([
    prisma.passivo.update({ where: { id: PASSIVO_ID }, data: { parcelaAtual: 28 } }),
    prisma.passivoHistorico.create({
      data: {
        passivoId: PASSIVO_ID,
        campo: "parcelaAtual",
        valorAnterior: String(passivo.parcelaAtual),
        valorNovo: "28",
        motivo: "Correção: contrato real já estava na parcela 28, cadastro estava desatualizado desde o início.",
      },
    }),
  ]);

  const depois = await prisma.passivo.findUniqueOrThrow({ where: { id: PASSIVO_ID } });
  console.log(`Depois: ${depois.nome} — parcelaAtual ${depois.parcelaAtual}/${depois.totalParcelas}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
