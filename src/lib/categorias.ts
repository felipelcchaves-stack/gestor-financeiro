import type { TipoTransacao } from "@/generated/prisma";

export type CategoriaOpcao = { id: string; nome: string; parentId: string | null };

// Categoria não tem campo `tipo` no schema (a base de categorias contorna
// isso na unha — ex: "Religião - Receita" vs "Religião - Despesa" como
// categorias raiz separadas). Sem esse campo, o jeito de saber se uma
// categoria "é de despesa" ou "é de receita" é olhar pro que já foi
// lançado com ela: o tipo mais frequente até agora. Categoria nunca usada
// fica de fora do mapa (sem sinal nenhum, não escondemos por engano).
export type ContagemCategoriaPorTipo = { categoriaId: string; tipo: TipoTransacao; quantidade: number };

export function calcularTipoPredominantePorCategoria(
  contagens: ContagemCategoriaPorTipo[]
): Record<string, TipoTransacao> {
  const melhores = new Map<string, { tipo: TipoTransacao; quantidade: number }>();
  for (const c of contagens) {
    const atual = melhores.get(c.categoriaId);
    if (!atual || c.quantidade > atual.quantidade) {
      melhores.set(c.categoriaId, { tipo: c.tipo, quantidade: c.quantidade });
    }
  }
  return Object.fromEntries(Array.from(melhores.entries()).map(([id, v]) => [id, v.tipo]));
}

export function ordenarCategoriasHierarquicamente(categorias: CategoriaOpcao[]) {
  const raizes = categorias.filter((c) => c.parentId === null);
  const porPai = new Map<string, CategoriaOpcao[]>();
  for (const c of categorias) {
    if (c.parentId) porPai.set(c.parentId, [...(porPai.get(c.parentId) ?? []), c]);
  }
  const resultado: { id: string; label: string }[] = [];
  for (const raiz of raizes) {
    resultado.push({ id: raiz.id, label: raiz.nome });
    for (const filha of porPai.get(raiz.id) ?? []) resultado.push({ id: filha.id, label: `— ${filha.nome}` });
  }
  return resultado;
}
