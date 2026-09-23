"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { centavosDoForm, textoDoForm } from "@/lib/form-helpers";
import { somaValorPassivosCentavos } from "@/app/metas/actions";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularMovimentacaoDoMes, inicioDoPeriodo } from "@/lib/ofensores";
import { calcularStatusRateio } from "@/lib/rateio";
import { gerarPromptCorteDeGastos, type MetaAlvoPrompt } from "@/lib/promptCorteDeGastos";
import { chamarGemini } from "@/lib/gemini";
import type { ResultadoSugestaoIA } from "@/app/resumo/ia/actions";

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

// Sugestão de corte AGRESSIVA (nunca de "ritmo confortável") pra fechar
// uma meta do cofre o mais rápido possível — pedido explícito do
// Felipe depois de rejeitar a versão anterior baseada em data-alvo/
// ritmo necessário: "não posso conviver com esse passivo por muito
// tempo". Mesmo formato {ok, texto|erro} de gerarSugestaoCorteIA — não
// lança exceção pro cliente pelo mesmo motivo (Server Actions apagam a
// mensagem de erro lançado em produção).
export async function gerarSugestaoParaMeta(metaId: string): Promise<ResultadoSugestaoIA> {
  try {
    const meta = await prisma.meta.findUnique({
      where: { id: metaId },
      include: { passivosAlvo: { include: { passivo: true } }, contaOrigem: true },
    });
    if (!meta) return { ok: false, erro: "Meta não encontrada." };

    const estado = await carregarEstadoAtual();
    const [movimentacaoDoMes, statusRateio] = await Promise.all([
      calcularMovimentacaoDoMes(inicioDoPeriodo("mes")),
      calcularStatusRateio(estado),
    ]);

    const passivosAlvo = meta.passivosAlvo.map((mp) => mp.passivo);
    const custosDocumentados = passivosAlvo.every((p) => p.custoMensalCentavos != null);
    const metaAlvo: MetaAlvoPrompt = {
      nome: passivosAlvo.length === 1 ? passivosAlvo[0].nome : meta.nome,
      saldoCentavos:
        passivosAlvo.length === 1 && passivosAlvo[0].valorQuitacaoCentavos != null
          ? passivosAlvo[0].valorQuitacaoCentavos
          : meta.valorAlvoCentavos,
      custoMensalCentavos: custosDocumentados
        ? passivosAlvo.reduce((soma, p) => soma + (p.custoMensalCentavos ?? 0), 0)
        : null,
      saldoJaSeparadoCentavos: statusRateio?.contaDestinoSaldoCentavos ?? meta.contaOrigem?.saldoAtualCentavos ?? 0,
    };

    const prompt = gerarPromptCorteDeGastos(estado, movimentacaoDoMes, statusRateio, metaAlvo);
    const texto = await chamarGemini(prompt);
    return { ok: true, texto };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha desconhecida ao gerar a sugestão." };
  }
}
