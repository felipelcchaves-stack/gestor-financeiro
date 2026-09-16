// Teste de ponta a ponta descartável: cria um Ativo+Passivo+Vínculo
// sintéticos com rendimento/taxa documentados, confere que a seção
// "Vale mais resgatar investimento e quitar" aparece renderizada de
// verdade em /ativos/[id] e /consultor (servidor de dev precisa estar
// rodando em localhost:3000), depois limpa tudo. Não toca no CDB real.
import { prisma } from "./src/lib/prisma";

async function main() {
  const ativo = await prisma.ativo.create({
    data: { nome: "TESTE Ativo Arbitragem UI", valorCentavos: 100_000_00, liquidez: "D+0", rendimentoMensalPct: 1.0 },
  });
  const passivo = await prisma.passivo.create({
    data: { nome: "TESTE Passivo Arbitragem UI", tipo: "teste", estrutura: "AMORTIZA_NORMAL", valorQuitacaoCentavos: 50_000_00, taxaJurosPct: 2.5 },
  });
  await prisma.ativoPassivoVinculo.create({
    data: { ativoId: ativo.id, passivoId: passivo.id, tipoVinculo: "GARANTIA", valorGarantidoCentavos: 50_000_00 },
  });

  const resAtivo = await fetch(`http://localhost:3000/ativos/${ativo.id}`);
  const htmlAtivo = await resAtivo.text();
  console.log("/ativos/[id] status:", resAtivo.status);
  if (!htmlAtivo.includes("te custando")) throw new Error("FALHOU: seção de arbitragem não apareceu em /ativos/[id]");
  if (!htmlAtivo.includes("TESTE Passivo Arbitragem UI")) throw new Error("FALHOU: passivo não listado em /ativos/[id]");
  console.log("OK: seção de arbitragem renderizada em /ativos/[id].");

  const resConsultor = await fetch("http://localhost:3000/consultor");
  const htmlConsultor = await resConsultor.text();
  console.log("/consultor status:", resConsultor.status);
  if (!htmlConsultor.includes("Vale mais resgatar investimento e quitar")) throw new Error("FALHOU: seção não apareceu em /consultor");
  if (!htmlConsultor.includes("TESTE Ativo Arbitragem UI")) throw new Error("FALHOU: ativo não listado em /consultor");
  console.log("OK: seção de arbitragem renderizada em /consultor.");

  await prisma.ativoPassivoVinculo.deleteMany({ where: { ativoId: ativo.id } });
  await prisma.passivo.delete({ where: { id: passivo.id } });
  await prisma.ativo.delete({ where: { id: ativo.id } });
  console.log("\nLimpeza concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
