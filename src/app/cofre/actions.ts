"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";
import { somaValorPassivosCentavos } from "@/app/metas/actions";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularMovimentacaoDoMes, inicioDoPeriodo } from "@/lib/ofensores";
import { calcularStatusRateio, type StatusRateio } from "@/lib/rateio";
import {
  gerarPromptCorteDeGastos,
  parseSugestaoCorte,
  nomesProtegidos,
  achatarDespesasPorCategoria,
  compararComAnalise,
  SUGESTAO_CORTE_SCHEMA,
  type MetaAlvoPrompt,
} from "@/lib/promptCorteDeGastos";
import { resolverAlvoDaMeta, calcularProjecaoMeta } from "@/lib/projecaoMeta";
import { chamarClaude } from "@/lib/claude";
import type { ResultadoSugestaoIA, SugestaoGerada } from "@/app/resumo/ia/actions";

function passivosDoForm(formData: FormData): string[] {
  return formData.getAll("passivosAlvo").map(String).filter(Boolean);
}

// Mesma criação de src/app/metas/actions.ts, só com contaOrigemId
// fixo (a conta do cofre) e redirecionando/revalidando pra cá em vez
// de /metas — a meta continua aparecendo em /metas normalmente também.
export async function criarMetaCofre(contaOrigemId: string, formData: FormData) {
  const nome = textoDoForm(formData, "nome");
  const valorAlvoInformado = centavosDoForm(formData, "valorAlvo");
  const dataAlvoRaw = textoDoForm(formData, "dataAlvo");
  const passivoIds = passivosDoForm(formData);

  if (!nome || !dataAlvoRaw) throw new Error("Preencha nome e data-alvo.");

  const valorAlvoCentavos = valorAlvoInformado ?? (await somaValorPassivosCentavos(passivoIds));
  if (valorAlvoCentavos == null) {
    throw new Error("Informe o valor-alvo, ou marque um passivo-alvo com saldo de quitação documentado.");
  }

  await prisma.meta.create({
    data: {
      nome,
      valorAlvoCentavos,
      dataAlvo: new Date(dataAlvoRaw),
      contaOrigemId,
      passivosAlvo: { create: passivoIds.map((passivoId) => ({ passivoId })) },
    },
  });

  revalidatePath("/cofre");
  redirect("/cofre");
}

function saldoDoCofre(statusRateio: StatusRateio | null, contaOrigemSaldoCentavos: number | null | undefined): number {
  return statusRateio?.contaDestinoSaldoCentavos ?? contaOrigemSaldoCentavos ?? 0;
}

// Sugestão de corte AGRESSIVA (nunca de "ritmo confortável") pra fechar
// uma meta do cofre o mais rápido possível — pedido explícito do
// Felipe depois de rejeitar a versão anterior baseada em data-alvo/
// ritmo necessário: "não posso conviver com esse passivo por muito
// tempo". Mesmo formato {ok, ...} | {ok:false, erro} de
// gerarSugestaoCorteIA — não lança exceção pro cliente pelo mesmo
// motivo (Server Actions apagam a mensagem de erro lançado em
// produção). Funciona pra qualquer meta do cofre, não só a do Agiota —
// pega o(s) passivo(s)-alvo de QUALQUER metaId recebido.
export async function gerarSugestaoParaMeta(metaId: string): Promise<ResultadoSugestaoIA> {
  try {
    const [meta, anterior] = await Promise.all([
      prisma.meta.findUnique({
        where: { id: metaId },
        include: { passivosAlvo: { include: { passivo: true } }, contaOrigem: true },
      }),
      prisma.sugestaoIACache.findUnique({ where: { metaId } }),
    ]);
    if (!meta) return { ok: false, erro: "Meta não encontrada." };

    const estado = await carregarEstadoAtual();
    const [movimentacaoDoMes, statusRateio] = await Promise.all([
      calcularMovimentacaoDoMes(inicioDoPeriodo("mes")),
      calcularStatusRateio(estado),
    ]);

    const passivosAlvo = meta.passivosAlvo.map((mp) => mp.passivo);
    const alvo = resolverAlvoDaMeta(meta, passivosAlvo);
    const saldoJaSeparadoCentavos = saldoDoCofre(statusRateio, meta.contaOrigem?.saldoAtualCentavos);
    const metaAlvo: MetaAlvoPrompt = { ...alvo, saldoJaSeparadoCentavos };
    const comparacao = compararComAnalise(
      anterior?.despesasPorCategoriaJson,
      anterior?.geradoEm,
      movimentacaoDoMes.despesasPorCategoria
    );

    const prompt = gerarPromptCorteDeGastos(estado, movimentacaoDoMes, statusRateio, metaAlvo, comparacao);
    const textoJson = await chamarClaude(prompt, { schema: SUGESTAO_CORTE_SCHEMA });
    const { resumo, cortes } = parseSugestaoCorte(textoJson, nomesProtegidos(movimentacaoDoMes));

    const geradoEm = new Date();
    const despesasPorCategoriaJson = JSON.stringify(achatarDespesasPorCategoria(movimentacaoDoMes.despesasPorCategoria));
    const comparacaoJson = JSON.stringify(comparacao);
    await prisma.sugestaoIACache.upsert({
      where: { metaId },
      create: { metaId, resumo, cortesJson: JSON.stringify(cortes), despesasPorCategoriaJson, comparacaoJson, geradoEm },
      update: { resumo, cortesJson: JSON.stringify(cortes), despesasPorCategoriaJson, comparacaoJson, geradoEm },
    });

    const projecao = calcularProjecaoMeta(alvo.saldoCentavos, saldoJaSeparadoCentavos, cortes);
    return { ok: true, resumo, cortes, geradoEm: geradoEm.toISOString(), projecao, comparacao };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha desconhecida ao gerar a sugestão." };
  }
}

// Só a parte salva (resumo/cortes/comparação) — a projeção não é
// cacheada de propósito, ela é recalculada em src/app/cofre/page.tsx
// com o saldo ATUAL do cofre (já carregado ali pra outros fins), pra
// "Ver última análise" nunca mostrar uma previsão desatualizada. A
// comparação, ao contrário, fica congelada como foi gerada — ver
// src/lib/promptCorteDeGastos.ts.
export async function obterUltimaSugestaoMeta(
  metaId: string
): Promise<Omit<SugestaoGerada, "projecao"> | null> {
  const row = await prisma.sugestaoIACache.findUnique({ where: { metaId } });
  if (!row) return null;
  return {
    resumo: row.resumo,
    cortes: JSON.parse(row.cortesJson),
    geradoEm: row.geradoEm.toISOString(),
    comparacao: row.comparacaoJson ? JSON.parse(row.comparacaoJson) : null,
  };
}
