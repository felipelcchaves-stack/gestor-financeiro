// Acha "isso aqui é a mesma coisa" em lote, em vez do Felipe precisar
// pensar num nome de credor e buscar um de cada vez (a busca "credor
// parecido" de /transacoes já existe, mas exige saber o que procurar).
// Reaproveita os dois sinais já construídos e testados nesta sessão:
// descrição parecida (sugerirClassificacao/calcularSimilaridadeDescricao)
// e valor+tipo repetido (calcularHistoricoPorValor) — só que aqui pra
// agrupar transações JÁ importadas que ainda faltam categoria/vínculo,
// não pra sugerir na hora de importar.

import { TipoTransacao } from "@/generated/prisma";
import { normalizarDescricao, calcularSimilaridadeDescricao } from "@/lib/classificacao";

export type TransacaoParaAgrupar = {
  id: string;
  descricao: string;
  valorCentavos: number;
  tipo: TipoTransacao;
  categoriaId: string | null;
  passivoId: string | null;
  ativoId: string | null;
  metaId: string | null;
};

export type VinculoSugerido = { tipo: "PASSIVO" | "ATIVO" | "META"; id: string };

export type GrupoSugerido = {
  chave: string;
  criterio: "descricao" | "valor";
  tipo: TipoTransacao;
  exemploDescricao: string;
  transacaoIds: string[];
  totalCentavos: number;
  categoriaIdSugerida: string | null;
  vinculoSugerido: VinculoSugerido | null;
};

// Mesmo limiar da sugestão automática de importação (sugerirClassificacao)
// — aqui compara sempre contra um único representante fixo por grupo, não
// par a par, então não corre o risco clássico de agrupamento por
// transitividade (A parecido com B, B parecido com C, A nada a ver com C).
const LIMIAR_SIMILARIDADE_GRUPO = 0.6;
const MINIMO_MEMBROS_GRUPO = 2;

function vinculoDe(t: TransacaoParaAgrupar): VinculoSugerido | null {
  if (t.passivoId) return { tipo: "PASSIVO", id: t.passivoId };
  if (t.ativoId) return { tipo: "ATIVO", id: t.ativoId };
  if (t.metaId) return { tipo: "META", id: t.metaId };
  return null;
}

function agruparPorDescricaoExata(transacoes: TransacaoParaAgrupar[]): Map<string, TransacaoParaAgrupar[]> {
  const grupos = new Map<string, TransacaoParaAgrupar[]>();
  for (const t of transacoes) {
    const chave = `${t.tipo}|${normalizarDescricao(t.descricao)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), t]);
  }
  for (const [chave, membros] of grupos) {
    if (membros.length < MINIMO_MEMBROS_GRUPO) grupos.delete(chave);
  }
  return grupos;
}

// Descrições que sobraram sozinhas tentam entrar num grupo já formado —
// só compara contra o primeiro membro de cada grupo (o "representante"),
// nunca par a par entre transações soltas.
function agruparPorDescricaoParecida(
  soltas: TransacaoParaAgrupar[],
  gruposExatos: Map<string, TransacaoParaAgrupar[]>
): TransacaoParaAgrupar[] {
  const aindaSoltas: TransacaoParaAgrupar[] = [];

  for (const t of soltas) {
    const tokensAlvo = normalizarDescricao(t.descricao);
    let melhorChave: string | null = null;
    let melhorScore = 0;

    for (const [chave, membros] of gruposExatos) {
      if (!chave.startsWith(`${t.tipo}|`)) continue;
      const representante = normalizarDescricao(membros[0].descricao);
      const score = calcularSimilaridadeDescricao(tokensAlvo, representante);
      if (score >= LIMIAR_SIMILARIDADE_GRUPO && score > melhorScore) {
        melhorScore = score;
        melhorChave = chave;
      }
    }

    if (melhorChave) {
      gruposExatos.get(melhorChave)!.push(t);
    } else {
      aindaSoltas.push(t);
    }
  }

  return aindaSoltas;
}

function agruparPorValorRepetido(transacoes: TransacaoParaAgrupar[]): Map<string, TransacaoParaAgrupar[]> {
  const grupos = new Map<string, TransacaoParaAgrupar[]>();
  for (const t of transacoes) {
    const chave = `${t.tipo}|${t.valorCentavos}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), t]);
  }
  for (const [chave, membros] of grupos) {
    if (membros.length < MINIMO_MEMBROS_GRUPO) grupos.delete(chave);
  }
  return grupos;
}

function paraGrupoSugerido(criterio: "descricao" | "valor", chave: string, membros: TransacaoParaAgrupar[]): GrupoSugerido | null {
  const categoriaIdSugerida = membros.find((m) => m.categoriaId != null)?.categoriaId ?? null;
  const vinculoSugerido = membros.map(vinculoDe).find((v) => v != null) ?? null;

  // Vínculo só é cobrado quando o próprio grupo já dá evidência de que ele
  // se aplica (algum membro já vinculado a um Passivo/Ativo/Meta) — a
  // maioria das transações (gasto do dia a dia) nunca vai ter vínculo, e
  // isso é normal, não "pendente". Sem essa condição, um grupo comum nunca
  // sai da lista mesmo depois de categorizado, porque "falta vínculo" seria
  // verdade pra sempre.
  const aindaFalta = (t: TransacaoParaAgrupar) => t.categoriaId == null || (vinculoSugerido != null && vinculoDe(t) == null);
  if (!membros.some(aindaFalta)) return null; // grupo já 100% resolvido, nada a mostrar

  return {
    chave,
    criterio,
    tipo: membros[0].tipo,
    exemploDescricao: membros[0].descricao,
    transacaoIds: membros.map((m) => m.id),
    totalCentavos: membros.reduce((acc, m) => acc + m.valorCentavos, 0),
    categoriaIdSugerida,
    vinculoSugerido,
  };
}

// Ponto único de entrada: junta os três critérios, descarta grupo que já
// não tem nada a resolver, e ordena pelo maior valor total em R$ — os
// grupos que mais importam primeiro.
export function encontrarGruposSugeridos(transacoes: TransacaoParaAgrupar[]): GrupoSugerido[] {
  const gruposExatos = agruparPorDescricaoExata(transacoes);
  const agrupadasPorDescricao = new Set(Array.from(gruposExatos.values()).flat().map((t) => t.id));

  const soltas = transacoes.filter((t) => !agrupadasPorDescricao.has(t.id));
  const aindaSoltas = agruparPorDescricaoParecida(soltas, gruposExatos);

  const gruposPorValor = agruparPorValorRepetido(aindaSoltas);

  const resultado: GrupoSugerido[] = [];
  for (const [chave, membros] of gruposExatos) {
    const grupo = paraGrupoSugerido("descricao", chave, membros);
    if (grupo) resultado.push(grupo);
  }
  for (const [chave, membros] of gruposPorValor) {
    const grupo = paraGrupoSugerido("valor", chave, membros);
    if (grupo) resultado.push(grupo);
  }

  return resultado.sort((a, b) => b.totalCentavos - a.totalCentavos);
}
