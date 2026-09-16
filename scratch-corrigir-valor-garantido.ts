// Correção pontual: valorGarantidoCentavos dos 6 vínculos GARANTIA criados
// pela migração estava usando "saldo devedor" (que já embute ~6 anos de
// juros futuros do sistema Price) em vez de "valor financiado" (o
// principal real emprestado) — inflava o "preso em garantia" a ponto de
// dar "livre" negativo, o que não reflete nenhum fato real documentado.
import { prisma } from "./src/lib/prisma";

const VALOR_FINANCIADO_POR_CONTRATO: Record<string, number> = {
  "Consignado Itaú 3264142369": 70_673_83,
  "Consignado Itaú 2728846334": 65_488_94,
  "Consignado Itaú 3006951390": 137_125_23,
  "Consignado Itaú 3118485766": 38_498_56,
  "Consignado Itaú 2869222998": 67_331_08,
  "Consignado Itaú 2861406995": 41_147_92,
};

async function main() {
  const passivos = await prisma.passivo.findMany({ where: { nome: { in: Object.keys(VALOR_FINANCIADO_POR_CONTRATO) } } });
  if (passivos.length !== 6) throw new Error(`Esperava 6 passivos, achei ${passivos.length}`);

  for (const p of passivos) {
    const valorFinanciado = VALOR_FINANCIADO_POR_CONTRATO[p.nome];
    const vinculo = await prisma.ativoPassivoVinculo.findFirst({ where: { passivoId: p.id, tipoVinculo: "GARANTIA" } });
    if (!vinculo) throw new Error(`Sem vínculo GARANTIA pra ${p.nome}`);
    await prisma.ativoPassivoVinculo.update({
      where: { id: vinculo.id },
      data: { valorGarantidoCentavos: valorFinanciado },
    });
    console.log(`${p.nome}: valorGarantidoCentavos ${vinculo.valorGarantidoCentavos} -> ${valorFinanciado}`);
  }

  const soma = Object.values(VALOR_FINANCIADO_POR_CONTRATO).reduce((s, v) => s + v, 0);
  console.log(`Soma valor financiado: R$${soma / 100}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
