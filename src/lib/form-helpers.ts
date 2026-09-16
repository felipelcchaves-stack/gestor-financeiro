import { reaisParaCentavos, parseNumeroBR } from "@/lib/money";

export function centavosDoForm(formData: FormData, campo: string): number | null {
  const valor = formData.get(campo);
  if (typeof valor !== "string") return null;
  const reais = parseNumeroBR(valor);
  return reais == null ? null : reaisParaCentavos(reais);
}

export function textoDoForm(formData: FormData, campo: string): string | null {
  const valor = formData.get(campo);
  if (typeof valor !== "string") return null;
  const tratado = valor.trim();
  return tratado.length > 0 ? tratado : null;
}

export function intDoForm(formData: FormData, campo: string): number | null {
  const valor = formData.get(campo);
  if (typeof valor !== "string" || valor.trim() === "") return null;
  const n = parseInt(valor, 10);
  return Number.isNaN(n) ? null : n;
}

export function floatDoForm(formData: FormData, campo: string): number | null {
  const valor = formData.get(campo);
  if (typeof valor !== "string") return null;
  return parseNumeroBR(valor);
}
