// Teste isolado e descartável: confere a melhoria de encontrarOrdemMenosJuros
// pra mais de 7 dívidas — busca exaustiva só no subgrupo SO_JUROS_SEM_AMORTIZACAO
// (que é o único que alimenta jurosTotalCentavos), em vez da heurística antiga
// (maior custo mensal primeiro, resto por saldo). Não toca em nenhum dado real.
import { prisma } from "./src/lib/prisma";
import { encontrarOrdemMenosJuros, simularOrdem, type PassivoParaOtimizacao } from "./src/lib/otimizacao";

function permutacoes<T>(itens: T[]): T[][] {
  if (itens.length <= 1) return [itens];
  const resultado: T[][] = [];
  for (let i = 0; i < itens.length; i++) {
    const resto = [...itens.slice(0, i), ...itens.slice(i + 1)];
    for (const p of permutacoes(resto)) resultado.push([itens[i], ...p]);
  }
  return resultado;
}

// Reproduz a heurística ANTIGA (antes desta correção) pra comparar.
function heuristicaAntiga(passivos: PassivoParaOtimizacao[]): string[] {
  const comJuros = passivos
    .filter((p) => p.estrutura === "SO_JUROS_SEM_AMORTIZACAO")
    .sort((a, b) => b.custoMensalCentavos - a.custoMensalCentavos);
  const semJuros = passivos
    .filter((p) => p.estrutura !== "SO_JUROS_SEM_AMORTIZACAO")
    .sort((a, b) => a.saldoCentavos - b.saldoCentavos);
  return [...comJuros, ...semJuros].map((p) => p.id);
}

async function main() {
  // --- Teste 1: dado real (17 passivos ativos e documentados) ---
  const reais = await prisma.passivo.findMany({
    where: { status: "ATIVO", valorQuitacaoCentavos: { not: null } },
  });
  const passivosReais: PassivoParaOtimizacao[] = reais.map((p) => ({
    id: p.id,
    nome: p.nome,
    saldoCentavos: p.valorQuitacaoCentavos!,
    custoMensalCentavos: p.custoMensalCentavos ?? 0,
    estrutura: p.estrutura,
  }));
  console.log(`Teste 1: ${passivosReais.length} passivos reais ativos e documentados.`);
  const comJurosReais = passivosReais.filter((p) => p.estrutura === "SO_JUROS_SEM_AMORTIZACAO");
  console.log(`  Subgrupo SO_JUROS_SEM_AMORTIZACAO: ${comJurosReais.length} (${comJurosReais.map((p) => p.nome).join(", ")})`);

  const { resultado: novo, exaustivo: novoExaustivo } = encontrarOrdemMenosJuros(passivosReais, 1000_00);
  const antigo = simularOrdem(passivosReais, heuristicaAntiga(passivosReais), 1000_00);
  console.log(`  Juro total heurística antiga: R$${(antigo.jurosTotalCentavos / 100).toFixed(2)}`);
  console.log(`  Juro total novo algoritmo:    R$${(novo.jurosTotalCentavos / 100).toFixed(2)} (exaustivo: ${novoExaustivo})`);
  if (novo.jurosTotalCentavos > antigo.jurosTotalCentavos) {
    throw new Error("FALHOU: novo algoritmo piorou o juro total em relação à heurística antiga");
  }
  if (passivosReais.length > 7 && comJurosReais.length <= 7 && !novoExaustivo) {
    throw new Error("FALHOU: deveria reportar exaustivo=true (subgrupo pequeno o bastante)");
  }
  console.log("  OK: novo algoritmo igual ou melhor que o antigo, com o dado real.\n");

  // --- Teste 2: caso sintético > 7 dívidas totais, subgrupo <= 7 — confere
  // que o resultado bate com o ótimo global de verdade (força bruta total) ---
  const sintetico: PassivoParaOtimizacao[] = [
    { id: "j1", nome: "TESTE J1", saldoCentavos: 50_000_00, custoMensalCentavos: 8_000_00, estrutura: "SO_JUROS_SEM_AMORTIZACAO" as const },
    { id: "j2", nome: "TESTE J2", saldoCentavos: 20_000_00, custoMensalCentavos: 3_000_00, estrutura: "SO_JUROS_SEM_AMORTIZACAO" as const },
    { id: "j3", nome: "TESTE J3", saldoCentavos: 80_000_00, custoMensalCentavos: 5_000_00, estrutura: "SO_JUROS_SEM_AMORTIZACAO" as const },
    { id: "n1", nome: "TESTE N1", saldoCentavos: 10_000_00, custoMensalCentavos: 500_00, estrutura: "AMORTIZA_NORMAL" as const },
    { id: "n2", nome: "TESTE N2", saldoCentavos: 15_000_00, custoMensalCentavos: 700_00, estrutura: "AMORTIZA_NORMAL" as const },
    { id: "n3", nome: "TESTE N3", saldoCentavos: 5_000_00, custoMensalCentavos: 300_00, estrutura: "SEM_JUROS" as const },
    { id: "n4", nome: "TESTE N4", saldoCentavos: 25_000_00, custoMensalCentavos: 900_00, estrutura: "AMORTIZA_NORMAL" as const },
    { id: "n5", nome: "TESTE N5", saldoCentavos: 8_000_00, custoMensalCentavos: 400_00, estrutura: "SEM_JUROS" as const },
  ];
  console.log(`Teste 2: caso sintético com ${sintetico.length} passivos (> 7, deveria cair na busca por subgrupo).`);

  const { resultado: resultadoSintetico, exaustivo: exaustivoSintetico } = encontrarOrdemMenosJuros(sintetico, 2_000_00);
  console.log(`  exaustivo: ${exaustivoSintetico} (esperado true — subgrupo de 3 cabe na busca exaustiva)`);
  if (!exaustivoSintetico) throw new Error("FALHOU: deveria ser exaustivo=true pro subgrupo de 3");

  // Ótimo global de verdade: força bruta nas 8! = 40320 combinações inteiras.
  const ids = sintetico.map((p) => p.id);
  let melhorGlobal = Infinity;
  for (const ordem of permutacoes(ids)) {
    const r = simularOrdem(sintetico, ordem, 2_000_00);
    if (r.jurosTotalCentavos < melhorGlobal) melhorGlobal = r.jurosTotalCentavos;
  }
  console.log(`  Juro total do algoritmo (subgrupo):  R$${(resultadoSintetico.jurosTotalCentavos / 100).toFixed(2)}`);
  console.log(`  Juro total ótimo global (força bruta 8!): R$${(melhorGlobal / 100).toFixed(2)}`);
  if (resultadoSintetico.jurosTotalCentavos !== melhorGlobal) {
    throw new Error(
      `FALHOU: algoritmo por subgrupo (R$${resultadoSintetico.jurosTotalCentavos / 100}) não bateu com o ótimo global de verdade (R$${melhorGlobal / 100})`
    );
  }
  console.log("  OK: o algoritmo por subgrupo encontrou exatamente o mínimo global de juro.\n");

  // --- Teste 3: mais de 7 dívidas "só juros" — deve cair no fallback (regra de Smith) ---
  const muitosComJuros: PassivoParaOtimizacao[] = Array.from({ length: 8 }, (_, i) => ({
    id: `j${i}`,
    nome: `TESTE J${i}`,
    saldoCentavos: (i + 1) * 10_000_00,
    custoMensalCentavos: (8 - i) * 1_000_00,
    estrutura: "SO_JUROS_SEM_AMORTIZACAO" as const,
  }));
  const { exaustivo: exaustivoFallback, resultado: resultadoFallback } = encontrarOrdemMenosJuros(muitosComJuros, 500_00);
  console.log(`Teste 3: 8 dívidas "só juros" (> LIMITE_BUSCA_EXAUSTIVA) — exaustivo esperado false, veio ${exaustivoFallback}`);
  if (exaustivoFallback) throw new Error("FALHOU: deveria ser exaustivo=false com 8 dívidas só-juros");
  // Confere que a ordem segue a razão custoMensal/saldo decrescente (regra de Smith).
  const ordemEsperada = [...muitosComJuros]
    .sort((a, b) => b.custoMensalCentavos / b.saldoCentavos - a.custoMensalCentavos / a.saldoCentavos)
    .map((p) => p.id);
  if (JSON.stringify(resultadoFallback.ordemIds.slice(0, 8)) !== JSON.stringify(ordemEsperada)) {
    throw new Error("FALHOU: ordem do fallback não segue a razão custoMensal/saldo decrescente esperada");
  }
  console.log("  OK: fallback segue a regra de Smith corretamente.\n");

  console.log("TODOS OS TESTES PASSARAM.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
