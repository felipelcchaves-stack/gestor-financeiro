// Teste isolado e descartável: confirma que "livre" sobe exatamente pelo
// valor garantido quando o passivo vinculado é quitado, sem tocar em
// nenhum dos 6 passivos reais do Felipe.
import { prisma } from "./src/lib/prisma";

async function main() {
  const ativo = await prisma.ativo.create({
    data: { nome: "TESTE Ativo Garantia", liquidez: "D+0", valorCentavos: 100_000_00 },
  });
  const passivoA = await prisma.passivo.create({
    data: { nome: "TESTE Passivo A", tipo: "teste", estrutura: "AMORTIZA_NORMAL", valorQuitacaoCentavos: 30_000_00 },
  });
  const passivoB = await prisma.passivo.create({
    data: { nome: "TESTE Passivo B", tipo: "teste", estrutura: "AMORTIZA_NORMAL", valorQuitacaoCentavos: 20_000_00 },
  });

  await prisma.ativoPassivoVinculo.create({
    data: { ativoId: ativo.id, passivoId: passivoA.id, tipoVinculo: "GARANTIA", valorGarantidoCentavos: 30_000_00 },
  });
  await prisma.ativoPassivoVinculo.create({
    data: { ativoId: ativo.id, passivoId: passivoB.id, tipoVinculo: "GARANTIA", valorGarantidoCentavos: 20_000_00 },
  });

  function calcular(vinculos: { tipoVinculo: string; valorGarantidoCentavos: number | null; passivo: { status: string } }[]) {
    const garantia = vinculos.filter((v) => v.tipoVinculo === "GARANTIA" && v.valorGarantidoCentavos != null);
    const preso = garantia
      .filter((v) => v.passivo.status === "ATIVO")
      .reduce((s, v) => s + (v.valorGarantidoCentavos ?? 0), 0);
    return { preso, livre: ativo.valorCentavos - preso };
  }

  const antes = await prisma.ativoPassivoVinculo.findMany({ where: { ativoId: ativo.id }, include: { passivo: true } });
  const r1 = calcular(antes);
  console.log("Antes de quitar nada:", r1); // esperado preso=50000.00, livre=50000.00
  if (r1.preso !== 50_000_00 || r1.livre !== 50_000_00) throw new Error("FALHOU: estado inicial errado");

  await prisma.passivo.update({ where: { id: passivoA.id }, data: { status: "QUITADO" } });
  const depois = await prisma.ativoPassivoVinculo.findMany({ where: { ativoId: ativo.id }, include: { passivo: true } });
  const r2 = calcular(depois);
  console.log("Depois de quitar A (30000):", r2); // esperado preso=20000.00, livre=80000.00
  if (r2.preso !== 20_000_00 || r2.livre !== 80_000_00) throw new Error("FALHOU: livre não subiu certo após quitação");

  await prisma.passivo.update({ where: { id: passivoB.id }, data: { status: "QUITADO" } });
  const final = await prisma.ativoPassivoVinculo.findMany({ where: { ativoId: ativo.id }, include: { passivo: true } });
  const r3 = calcular(final);
  console.log("Depois de quitar os dois:", r3); // esperado preso=0, livre=100000.00 (== valorCentavos do ativo, sem inventar nada)
  if (r3.preso !== 0 || r3.livre !== ativo.valorCentavos) throw new Error("FALHOU: livre deveria igualar o valor real do ativo");

  console.log("OK: todos os cenários passaram.");

  // limpeza
  await prisma.ativoPassivoVinculo.deleteMany({ where: { ativoId: ativo.id } });
  await prisma.passivo.deleteMany({ where: { id: { in: [passivoA.id, passivoB.id] } } });
  await prisma.ativo.delete({ where: { id: ativo.id } });
  console.log("Limpeza concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
