// Correção de dado real (não descartável): o "6 consignados Itaú
// (garantia CDB)" está QUITADO no banco, mas não foi pago de verdade —
// foi substituído pelos 6 passivos individuais criados num segmento
// anterior. Marca isso explicitamente pra parar de aparecer como uma
// vitória de R$466.190,28 na trilha de saída (ver
// src/lib/estadoAtual.ts).
import { prisma } from "./src/lib/prisma";

const PASSIVO_ID = "cmtu83yt9001etht74djpmxwy";

async function main() {
  const passivo = await prisma.passivo.findUniqueOrThrow({ where: { id: PASSIVO_ID } });
  console.log(`Antes: ${passivo.nome} — status ${passivo.status}, substituido ${passivo.substituido}`);
  if (passivo.nome !== "6 consignados Itaú (garantia CDB)") {
    throw new Error(`Passivo inesperado: ${passivo.nome}`);
  }
  if (passivo.status !== "QUITADO") {
    throw new Error(`Status inesperado: ${passivo.status} (esperava QUITADO)`);
  }

  await prisma.passivo.update({ where: { id: PASSIVO_ID }, data: { substituido: true } });

  const depois = await prisma.passivo.findUniqueOrThrow({ where: { id: PASSIVO_ID } });
  console.log(`Depois: ${depois.nome} — status ${depois.status}, substituido ${depois.substituido}`);

  const outros = await prisma.passivo.count({ where: { substituido: true, id: { not: PASSIVO_ID } } });
  console.log(`Outros passivos marcados substituido (deveria ser 0): ${outros}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
