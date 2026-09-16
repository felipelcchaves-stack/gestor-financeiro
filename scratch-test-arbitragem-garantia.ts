// Teste isolado e descartável: confere calcularArbitragemGarantia com
// dados 100% sintéticos — sem tocar no CDB real nem nos 6 consignados
// reais. Não precisa do banco (função pura), mas roda via tsx pra
// manter o padrão de verificação da sessão.
import { calcularArbitragemGarantia, type AtivoParaArbitragem } from "./src/lib/arbitragemGarantia";

function assertEqual(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`FALHOU: ${msg} — esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
  }
}

// --- Cenário 1: ativo sem rendimento documentado -> nunca aparece ---
const semRendimento: AtivoParaArbitragem[] = [
  {
    id: "a1",
    nome: "TESTE Ativo Sem Rendimento",
    rendimentoMensalPct: null,
    vinculos: [
      { tipoVinculo: "GARANTIA", valorGarantidoCentavos: 100_000_00, passivo: { id: "p1", nome: "TESTE P1", status: "ATIVO", taxaJurosPct: 2.5 } },
    ],
  },
];
assertEqual(calcularArbitragemGarantia(semRendimento), [], "ativo sem rendimentoMensalPct não deveria gerar oportunidade");

// --- Cenário 2: rendimento do ativo MAIOR que a taxa da dívida -> não vale resgatar ---
const rendimentoAlto: AtivoParaArbitragem[] = [
  {
    id: "a2",
    nome: "TESTE Ativo Rendimento Alto",
    rendimentoMensalPct: 3.0,
    vinculos: [
      { tipoVinculo: "GARANTIA", valorGarantidoCentavos: 100_000_00, passivo: { id: "p2", nome: "TESTE P2", status: "ATIVO", taxaJurosPct: 2.0 } },
    ],
  },
];
assertEqual(calcularArbitragemGarantia(rendimentoAlto), [], "rendimento maior que a taxa da dívida não deveria gerar oportunidade");

// --- Cenário 3: caso real (números do CDB/consignados, mas com ids sintéticos) ---
const casoReal: AtivoParaArbitragem[] = [
  {
    id: "cdb",
    nome: "TESTE CDB",
    rendimentoMensalPct: 1.0,
    vinculos: [
      { tipoVinculo: "GARANTIA", valorGarantidoCentavos: 70_673_83, passivo: { id: "c1", nome: "TESTE Consignado 2.26%", status: "ATIVO", taxaJurosPct: 2.26 } },
      { tipoVinculo: "GARANTIA", valorGarantidoCentavos: 41_147_92, passivo: { id: "c2", nome: "TESTE Consignado 2.66%", status: "ATIVO", taxaJurosPct: 2.66 } },
      // Vínculo FINANCIAMENTO não deve entrar (só GARANTIA conta aqui).
      { tipoVinculo: "FINANCIAMENTO", valorGarantidoCentavos: 10_000_00, passivo: { id: "c3", nome: "TESTE Financiamento", status: "ATIVO", taxaJurosPct: 5.0 } },
      // Passivo já QUITADO não deve entrar.
      { tipoVinculo: "GARANTIA", valorGarantidoCentavos: 5_000_00, passivo: { id: "c4", nome: "TESTE Quitado", status: "QUITADO", taxaJurosPct: 9.0 } },
      // Sem taxaJurosPct documentada não deve entrar.
      { tipoVinculo: "GARANTIA", valorGarantidoCentavos: 5_000_00, passivo: { id: "c5", nome: "TESTE Sem Taxa", status: "ATIVO", taxaJurosPct: null } },
    ],
  },
];

const resultado = calcularArbitragemGarantia(casoReal);
console.log(JSON.stringify(resultado, null, 2));

if (resultado.length !== 1) throw new Error(`FALHOU: esperava 1 ativo com oportunidade, veio ${resultado.length}`);
const r = resultado[0];
if (r.oportunidades.length !== 2) throw new Error(`FALHOU: esperava 2 oportunidades (só GARANTIA + ATIVO + taxa documentada), veio ${r.oportunidades.length}`);

// Conferência manual: custo = valorGarantido * (taxa - rendimento) / 100
const esperadoC1 = Math.round(70_673_83 * (2.26 - 1.0) / 100); // = 890489 centavos = R$890,89
const esperadoC2 = Math.round(41_147_92 * (2.66 - 1.0) / 100); // = 683055 centavos = R$683,06 (aprox)
const c1 = r.oportunidades.find((o) => o.passivoId === "c1")!;
const c2 = r.oportunidades.find((o) => o.passivoId === "c2")!;
assertEqual(c1.custoMensalCentavos, esperadoC1, "custo mensal do consignado c1 bate com a conta manual");
assertEqual(c2.custoMensalCentavos, esperadoC2, "custo mensal do consignado c2 bate com a conta manual");

// Ordenado do que mais sangra pro que menos.
assertEqual(r.oportunidades[0].passivoId, "c1", "primeira oportunidade deveria ser a de maior custo mensal (c1)");

const totalEsperado = esperadoC1 + esperadoC2;
assertEqual(r.custoMensalTotalCentavos, totalEsperado, "total mensal bate com a soma das duas oportunidades");

console.log("\nOK: todos os cenários passaram.");
