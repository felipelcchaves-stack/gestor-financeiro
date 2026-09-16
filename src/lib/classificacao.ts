import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { TipoTransacao } from "@/generated/prisma";

// Normaliza a descrição de um lançamento para servir de chave de uma regra de
// classificação aprendida (seção 4.1/5 do PRD): remove números/datas/ids que
// variam a cada mês (ex: "PIX TRANSF ALEKSAN 09/09" -> "PIX TRANSF ALEKSAN"),
// para que a mesma regra seja sugerida em lançamentos futuros do mesmo credor.
export function normalizarDescricao(descricao: string): string {
  return descricao
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d+/g, "")
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// origemId identifica de onde vem o lançamento pra fins de dedupe — o id da
// conta (extrato bancário) ou do passivo/cartão (fatura de cartão), já que
// o mesmo lançamento (mesmo dia+descrição+valor) pode existir legitimamente
// em fontes diferentes sem ser duplicata.
export function calcularHashDedupe(params: {
  origemId: string;
  data: Date;
  descricao: string;
  valorCentavos: number;
}): string {
  const chave = [
    params.origemId,
    params.data.toISOString().slice(0, 10),
    params.descricao.trim().toUpperCase(),
    params.valorCentavos,
  ].join("|");

  return createHash("sha256").update(chave).digest("hex");
}

export type SugestaoClassificacao = {
  tipo: TipoTransacao | null;
  categoriaId: string | null;
  passivoId: string | null;
  ativoId: string | null;
  metaId: string | null;
  essencial: boolean;
  origem: "exata" | "aproximada" | "valor";
};

// Chave usada tanto por calcularHistoricoPorValor quanto por quem monta o
// mapa manualmente (ex: num teste) — mesmo valor+tipo pode ter sido usado
// pra coisas diferentes (uma DESPESA de R$50 não tem nada a ver com uma
// ENTRADA de R$50), por isso o tipo faz parte da chave.
export function chaveHistoricoPorValor(tipo: TipoTransacao, valorCentavos: number): string {
  return `${tipo}|${valorCentavos}`;
}

export type RegraParaSugestao = {
  padraoDescricao: string;
  tipo: TipoTransacao;
  categoriaId: string | null;
  passivoId: string | null;
  ativoId: string | null;
  metaId: string | null;
};

export type RecorrenciaParaSugestao = {
  nome: string;
  tipo: TipoTransacao;
  categoriaId: string | null;
  passivoId: string | null;
  essencial: boolean;
};

// Só bate como "aproximada" com bastante sobreposição de palavras — o
// objetivo é pegar variações de um mesmo credor/loja (token extra ou
// faltando), não arriscar juntar coisas diferentes por causa de uma
// palavra genérica em comum ("PIX", "COMPRA" etc.).
const LIMIAR_SIMILARIDADE_APROXIMADA = 0.6;
const MINIMO_TOKENS_COMUNS = 2;

function tokenizar(texto: string): Set<string> {
  return new Set(texto.split(" ").filter((t) => t.length > 0));
}

function similaridadeJaccard(a: Set<string>, b: Set<string>): { score: number; comuns: number } {
  let comuns = 0;
  for (const token of a) if (b.has(token)) comuns++;
  const uniao = new Set([...a, ...b]).size;
  return { score: uniao === 0 ? 0 : comuns / uniao, comuns };
}

// Similaridade por sobreposição de palavras entre duas descrições
// (0 a 1) — mesma conta usada internamente por sugerirClassificacao, só
// que exposta pra quem precisar comparar duas descrições específicas
// (ex: achar outras transações parecidas com uma já existente, na tela
// de Transações). Recebe as descrições já normalizadas
// (normalizarDescricao) ou cruas — funciona nos dois casos, mas fica
// mais preciso se ambas já vierem normalizadas.
export function calcularSimilaridadeDescricao(a: string, b: string): number {
  return similaridadeJaccard(tokenizar(a), tokenizar(b)).score;
}

function encontrarMaisParecido<T>(descricaoNormalizada: string, candidatos: T[], chave: (item: T) => string): T | null {
  const tokensAlvo = tokenizar(descricaoNormalizada);
  let melhor: { item: T; score: number } | null = null;

  for (const candidato of candidatos) {
    const { score, comuns } = similaridadeJaccard(tokensAlvo, tokenizar(chave(candidato)));
    if (score >= LIMIAR_SIMILARIDADE_APROXIMADA && comuns >= MINIMO_TOKENS_COMUNS) {
      if (!melhor || score > melhor.score) melhor = { item: candidato, score };
    }
  }

  return melhor?.item ?? null;
}

// Sugere categoria/vínculo/essencial pra uma descrição já normalizada, a
// partir de tudo que já foi classificado antes (extrato ou fatura — a
// mesma função serve pros dois). Primeiro tenta bater exato (mais
// confiável); se não achar, tenta uma aproximação por sobreposição de
// palavras, pra pegar variações do mesmo credor que o extrato/fatura
// escreve de um jeito ligeiramente diferente a cada lançamento; se ainda
// assim não achar nada, tenta o valor histórico — útil quando o credor
// muda a cada lançamento mas o valor é sempre classificado do mesmo jeito
// (ex: doação/dízimo de valor fixo, pagador diferente toda vez). Esse
// último nível é o mais fraco dos três e só existe quando quem chama já
// filtrou o histórico pra combinações unânimes (ver
// calcularHistoricoPorValor) — nunca decide sozinho em cima de valor
// ambíguo. Nunca aplica nada sozinha — quem chama sempre deixa a sugestão
// editável antes de confirmar.
export function sugerirClassificacao(params: {
  descricaoNormalizada: string;
  regras: RegraParaSugestao[];
  recorrencias: RecorrenciaParaSugestao[];
  valorCentavos?: number;
  tipoCandidato?: TipoTransacao;
  historicoPorValor?: Map<string, string>;
}): SugestaoClassificacao | null {
  const { descricaoNormalizada, regras, recorrencias, valorCentavos, tipoCandidato, historicoPorValor } = params;

  const regraExata = regras.find((r) => r.padraoDescricao === descricaoNormalizada);
  const recorrenciaExata = recorrencias.find((r) => r.nome === descricaoNormalizada);

  if (regraExata || recorrenciaExata) {
    return {
      tipo: regraExata?.tipo ?? recorrenciaExata?.tipo ?? null,
      categoriaId: regraExata?.categoriaId ?? recorrenciaExata?.categoriaId ?? null,
      passivoId: regraExata?.passivoId ?? recorrenciaExata?.passivoId ?? null,
      ativoId: regraExata?.ativoId ?? null,
      metaId: regraExata?.metaId ?? null,
      essencial: recorrenciaExata?.essencial ?? false,
      origem: "exata",
    };
  }

  const regraAproximada = encontrarMaisParecido(descricaoNormalizada, regras, (r) => r.padraoDescricao);
  const recorrenciaAproximada = encontrarMaisParecido(descricaoNormalizada, recorrencias, (r) => r.nome);

  if (regraAproximada || recorrenciaAproximada) {
    return {
      tipo: regraAproximada?.tipo ?? recorrenciaAproximada?.tipo ?? null,
      categoriaId: regraAproximada?.categoriaId ?? recorrenciaAproximada?.categoriaId ?? null,
      passivoId: regraAproximada?.passivoId ?? recorrenciaAproximada?.passivoId ?? null,
      ativoId: regraAproximada?.ativoId ?? null,
      metaId: regraAproximada?.metaId ?? null,
      essencial: recorrenciaAproximada?.essencial ?? false,
      origem: "aproximada",
    };
  }

  if (historicoPorValor && valorCentavos != null && tipoCandidato) {
    const categoriaId = historicoPorValor.get(chaveHistoricoPorValor(tipoCandidato, valorCentavos));
    if (categoriaId) {
      return {
        tipo: null,
        categoriaId,
        passivoId: null,
        ativoId: null,
        metaId: null,
        essencial: false,
        origem: "valor",
      };
    }
  }

  return null;
}

// Mínimo de ocorrências passadas pra confiar num valor+tipo — 1 ocorrência
// só pode ser coincidência, 2+ já é um padrão que vale sugerir (com
// revisão do usuário antes de confirmar, igual às outras origens).
const MINIMO_OCORRENCIAS_HISTORICO_VALOR = 2;

// Varre todas as transações já categorizadas e devolve só as combinações
// de (valor, tipo) que SEMPRE caíram na mesma categoria — nunca as que já
// foram usadas de dois jeitos diferentes (ambíguas), porque nesse caso
// sugerir por valor seria arriscar mais do que ajudar. Usado por
// analisarExtrato/analisarFatura como o 3º nível de sugestão de
// sugerirClassificacao (depois de exata e aproximada por descrição).
export async function calcularHistoricoPorValor(): Promise<Map<string, string>> {
  const grupos = await prisma.transacao.groupBy({
    by: ["valorCentavos", "tipo", "categoriaId"],
    where: { categoriaId: { not: null } },
    _count: { _all: true },
  });

  const porChave = new Map<string, { categoriaId: string; total: number; categoriasDistintas: Set<string> }>();

  for (const g of grupos) {
    if (!g.categoriaId) continue;
    const chave = chaveHistoricoPorValor(g.tipo, g.valorCentavos);
    const entrada = porChave.get(chave) ?? { categoriaId: g.categoriaId, total: 0, categoriasDistintas: new Set() };
    entrada.total += g._count._all;
    entrada.categoriasDistintas.add(g.categoriaId);
    porChave.set(chave, entrada);
  }

  const resultado = new Map<string, string>();
  for (const [chave, entrada] of porChave) {
    if (entrada.categoriasDistintas.size === 1 && entrada.total >= MINIMO_OCORRENCIAS_HISTORICO_VALOR) {
      resultado.set(chave, entrada.categoriaId);
    }
  }
  return resultado;
}

// Upsert de RegraClassificacao compartilhado por todo lugar que "ensina"
// uma classificação — confirmação de importação (extrato/fatura/imagem),
// edição individual e reclassificação em lote de transações. Dedupe pela
// mesma chave normalizada; cada confirmação nova incrementa
// vezesConfirmada, reforçando a confiança na regra.
export async function aprenderRegraClassificacao(params: {
  descricao: string;
  tipo: TipoTransacao;
  categoriaId: string;
  passivoId?: string | null;
  ativoId?: string | null;
  metaId?: string | null;
}) {
  const padrao = normalizarDescricao(params.descricao);
  const regraExistente = await prisma.regraClassificacao.findUnique({ where: { padraoDescricao: padrao } });

  const dadosRegra = {
    tipo: params.tipo,
    categoriaId: params.categoriaId,
    passivoId: params.passivoId ?? null,
    ativoId: params.ativoId ?? null,
    metaId: params.metaId ?? null,
  };

  if (regraExistente) {
    await prisma.regraClassificacao.update({
      where: { id: regraExistente.id },
      data: { ...dadosRegra, vezesConfirmada: { increment: 1 } },
    });
  } else {
    await prisma.regraClassificacao.create({ data: { padraoDescricao: padrao, ...dadosRegra } });
  }
}
