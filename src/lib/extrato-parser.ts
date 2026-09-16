// Parser de extrato bancário em PDF (seção 4.1 do PRD).
//
// Bancos não têm um formato padronizado de extrato em PDF. Este parser cobre
// o layout mais comum (uma linha por lançamento: data, descrição, valor e,
// opcionalmente, saldo após o lançamento), com sinal indicado por "-" ou por
// sufixo D/C. Linhas que não batem com o padrão são reportadas como "não
// reconhecidas" em vez de silenciosamente descartadas — o objetivo é nunca
// perder dado sem avisar, mesmo que o parser não seja perfeito para todo
// layout de banco. Se o layout real de um banco específico não for
// reconhecido, ajustar o regex abaixo é o próximo passo, não reescrever tudo.

export type CandidatoTransacao = {
  linhaOriginal: string;
  data: string; // ISO yyyy-mm-dd
  descricao: string;
  valorCentavos: number; // sempre positivo — o sinal vira `tipoSugerido`
  tipoSugerido: "DESPESA" | "ENTRADA";
  saldoAposCentavos: number | null;
};

export type ResultadoParseExtrato = {
  candidatos: CandidatoTransacao[];
  linhasNaoReconhecidas: string[];
  resumosDiariosIgnorados: number;
  saldoDetectado: { data: string; valorCentavos: number } | null;
};

const TOKEN_MONETARIO = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`;
const REGEX_LINHA = new RegExp(
  String.raw`^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+(${TOKEN_MONETARIO})\s*([DC])?\s*(${TOKEN_MONETARIO})?\s*([DC])?$`
);
const REGEX_LINHA_IGNORAVEL = /^(--\s*\d+\s*of\s*\d+\s*--|página\s*\d+|extrato|saldo\s*(anterior|atual)\b.*)/i;
// "SALDO DO DIA" (e variações) não é um lançamento — é um resumo do saldo
// naquele dia. Alguns bancos (ex: Itaú) só mostram o saldo nessas linhas
// separadas, nunca numa coluna dentro de cada transação — por isso o valor
// delas é aproveitado pra achar o saldo atual da conta, em vez de virar uma
// "entrada" falsa.
const REGEX_DESCRICAO_RESUMO_DIARIO = /^saldo\b/i;

export function parseValorBRL(valor: string): number {
  const negativo = valor.trim().startsWith("-");
  const numerico = valor.replace(/[.-]/g, "").replace(",", ".");
  const centavos = Math.round(parseFloat(numerico) * 100);
  return negativo ? -centavos : centavos;
}

function normalizarData(dataTexto: string, anoReferencia: number): string {
  const partes = dataTexto.split("/");
  const dia = partes[0].padStart(2, "0");
  const mes = partes[1].padStart(2, "0");
  let ano = anoReferencia;

  if (partes.length === 3) {
    ano = partes[2].length === 2 ? 2000 + parseInt(partes[2], 10) : parseInt(partes[2], 10);
  }

  return `${ano}-${mes}-${dia}`;
}

export function parseExtratoTexto(
  texto: string,
  anoReferencia: number = new Date().getFullYear()
): ResultadoParseExtrato {
  const candidatos: CandidatoTransacao[] = [];
  const linhasNaoReconhecidas: string[] = [];
  let resumosDiariosIgnorados = 0;
  let saldoDetectado: { data: string; valorCentavos: number } | null = null;

  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const linha of linhas) {
    if (REGEX_LINHA_IGNORAVEL.test(linha)) continue;

    const match = linha.match(REGEX_LINHA);
    if (!match) {
      if (/\d{2}\/\d{2}/.test(linha)) {
        // parece um lançamento (tem data) mas não bateu com o padrão esperado
        linhasNaoReconhecidas.push(linha);
      }
      continue;
    }

    const [, dataTexto, descricao, valorToken, marcadorValor, saldoToken] = match;
    const descricaoTratada = descricao.trim();
    const data = normalizarData(dataTexto, anoReferencia);

    if (REGEX_DESCRICAO_RESUMO_DIARIO.test(descricaoTratada)) {
      resumosDiariosIgnorados += 1;
      const valorResumo = Math.abs(parseValorBRL(valorToken));
      if (!saldoDetectado || data >= saldoDetectado.data) {
        saldoDetectado = { data, valorCentavos: valorResumo };
      }
      continue;
    }

    const valorCentavosComSinal = parseValorBRL(valorToken);
    const negativoPorMarcador = marcadorValor === "D";
    const negativo = valorCentavosComSinal < 0 || negativoPorMarcador;

    candidatos.push({
      linhaOriginal: linha,
      data,
      descricao: descricaoTratada,
      valorCentavos: Math.abs(valorCentavosComSinal),
      tipoSugerido: negativo ? "DESPESA" : "ENTRADA",
      saldoAposCentavos: saldoToken ? Math.abs(parseValorBRL(saldoToken)) : null,
    });
  }

  return { candidatos, linhasNaoReconhecidas, resumosDiariosIgnorados, saldoDetectado };
}
