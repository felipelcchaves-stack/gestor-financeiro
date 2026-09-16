// Extração "melhor palpite" de fatura de cartão em PDF (seção 4.1 do PRD).
// Sem um PDF real de fatura em mãos, não há como garantir que o layout
// bate — por isso cada campo que não for encontrado fica em branco pro
// usuário preencher, em vez de travar ou inventar valor.

import { parseValorBRL } from "@/lib/extrato-parser";

export type CandidatoFatura = {
  valorCentavos: number | null;
  valorMinimoCentavos: number | null;
  vencimento: string | null; // yyyy-mm-dd
};

const TOKEN_MONETARIO = String.raw`R?\$?\s?-?\d{1,3}(?:\.\d{3})*,\d{2}`;

function buscarValor(texto: string, rotulos: string[]): number | null {
  for (const rotulo of rotulos) {
    const regex = new RegExp(`${rotulo}[^\\d\\-]{0,15}(${TOKEN_MONETARIO})`, "i");
    const match = texto.match(regex);
    if (match) return Math.abs(parseValorBRL(match[1].replace(/[R$\s]/g, "")));
  }
  return null;
}

function buscarData(texto: string, rotulos: string[]): string | null {
  for (const rotulo of rotulos) {
    const regex = new RegExp(`${rotulo}[^\\d]{0,10}(\\d{2})/(\\d{2})/(\\d{2,4})`, "i");
    const match = texto.match(regex);
    if (match) {
      const [, dia, mes, anoRaw] = match;
      const ano = anoRaw.length === 2 ? `20${anoRaw}` : anoRaw;
      return `${ano}-${mes}-${dia}`;
    }
  }
  return null;
}

export function parseFaturaTexto(texto: string): CandidatoFatura {
  return {
    valorCentavos: buscarValor(texto, ["total\\s+da\\s+fatura", "valor\\s+total", "total\\s+a\\s+pagar"]),
    valorMinimoCentavos: buscarValor(texto, ["pagamento\\s+m[ií]nimo", "valor\\s+m[ií]nimo", "m[ií]nimo"]),
    vencimento: buscarData(texto, ["vencimento", "data\\s+de\\s+vencimento"]),
  };
}

export type ParcelaDetectada = { atual: number; total: number };

// Formatos mais comuns de fatura brasileira pra marcar parcelamento:
// "PARC 2/5", "PARC. 02/10", "PARCELA 2/5" (rótulo explícito, prioridade),
// ou o formato solto "02/10" perto do fim da descrição (sem rótulo, mais
// arriscado de confundir com outra coisa, por isso só aceito no fim da
// string). "1/1" não conta como parcelado — é um pagamento único.
const REGEX_PARCELA_ROTULADA = /\bparc(?:ela)?\.?\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/i;
const REGEX_PARCELA_SOLTA = /(\d{1,2})\s*\/\s*(\d{1,2})\s*$/;

export function detectarParcela(descricao: string): ParcelaDetectada | null {
  const match = descricao.match(REGEX_PARCELA_ROTULADA) ?? descricao.match(REGEX_PARCELA_SOLTA);
  if (!match) return null;

  const atual = Number(match[1]);
  const total = Number(match[2]);
  if (total < 2 || atual < 1 || atual > total) return null;

  return { atual, total };
}

// Extração linha a linha das compras da fatura (cada lançamento individual),
// mesmo espírito do parser de extrato: cobre o layout mais comum ("DD/MM
// descrição valor"), e linha que não bate com o padrão vira "não
// reconhecida" em vez de inventada ou silenciosamente descartada.
export type CandidatoLancamentoFatura = {
  data: string; // ISO yyyy-mm-dd
  descricao: string;
  valorCentavos: number;
  tipoSugerido: "DESPESA" | "ENTRADA";
  parcelaSugerida: ParcelaDetectada | null;
};

export type ResultadoParseLinhasFatura = {
  candidatos: CandidatoLancamentoFatura[];
  linhasNaoReconhecidas: string[];
};

const REGEX_LINHA_FATURA = new RegExp(String.raw`^(\d{2}\/\d{2})\s+(.+?)\s+(${TOKEN_MONETARIO})$`);
const REGEX_LINHA_IGNORAVEL_FATURA =
  /^(total|subtotal|saldo\s*anterior|pagamento\s*m[ií]nimo|limite|vencimento|p[aá]gina\s*\d+|fatura\s*fechada|--\s*\d+\s*of\s*\d+\s*--)/i;

export function parseLinhasFatura(
  texto: string,
  anoReferencia: number = new Date().getFullYear()
): ResultadoParseLinhasFatura {
  const candidatos: CandidatoLancamentoFatura[] = [];
  const linhasNaoReconhecidas: string[] = [];

  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const linha of linhas) {
    if (REGEX_LINHA_IGNORAVEL_FATURA.test(linha)) continue;

    const match = linha.match(REGEX_LINHA_FATURA);
    if (!match) {
      if (/^\d{2}\/\d{2}\b/.test(linha)) linhasNaoReconhecidas.push(linha);
      continue;
    }

    const [, dataTexto, descricao, valorToken] = match;
    const [dia, mes] = dataTexto.split("/");
    const data = `${anoReferencia}-${mes}-${dia}`;
    const valorComSinal = parseValorBRL(valorToken.replace(/[R$\s]/g, ""));

    const descricaoTrimada = descricao.trim();
    candidatos.push({
      data,
      descricao: descricaoTrimada,
      valorCentavos: Math.abs(valorComSinal),
      tipoSugerido: valorComSinal < 0 ? "ENTRADA" : "DESPESA",
      parcelaSugerida: detectarParcela(descricaoTrimada),
    });
  }

  return { candidatos, linhasNaoReconhecidas };
}
