// Todo valor monetário é armazenado em centavos (Int) para evitar erro de
// arredondamento de ponto flutuante em cálculos financeiros.

export function centavosParaReais(centavos: number): number {
  return centavos / 100;
}

export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

// Interpreta um número digitado tanto no formato brasileiro ("36.085,16" ou
// "36085,16") quanto no formato simples usado por defaultValue de inputs
// ("36085.16") — sem exigir que o usuário lembre de digitar sem separador de
// milhar. Regra: se tem vírgula, ela é o separador decimal (qualquer ponto
// antes dela é só agrupamento de milhar e é descartado); sem vírgula, o
// ponto (se houver) é tratado como decimal, igual a um número comum.
export function parseNumeroBR(valor: string): number | null {
  const tratado = valor.trim();
  if (tratado.length === 0) return null;

  const normalizado = tratado.includes(",")
    ? tratado.replaceAll(".", "").replace(",", ".")
    : tratado;

  const numero = parseFloat(normalizado);
  return Number.isNaN(numero) ? null : numero;
}

export function formatarBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavosParaReais(centavos));
}

export function mesAnoDaquiA(mesesAPartirDeHoje: number, hoje: Date = new Date()): string {
  const data = new Date(hoje.getFullYear(), hoje.getMonth() + mesesAPartirDeHoje, 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(data);
}
