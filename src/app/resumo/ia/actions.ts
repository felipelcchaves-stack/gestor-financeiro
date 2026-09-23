"use server";

import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularMovimentacaoDoMes, inicioDoPeriodo } from "@/lib/ofensores";
import { calcularStatusRateio } from "@/lib/rateio";
import { gerarPromptCorteDeGastos } from "@/lib/promptCorteDeGastos";
import { chamarGemini } from "@/lib/gemini";

export type ResultadoSugestaoIA = { ok: true; texto: string } | { ok: false; erro: string };

// Nunca lança exceção pra fora — em produção, o Next.js apaga a
// mensagem de um erro lançado numa Server Action por segurança (só
// manda um código genérico pro cliente, tipo "Minified React error
// #441"), então qualquer `throw` aqui vira uma tela ilegível mesmo
// com try/catch do lado do cliente. Sempre devolvendo um objeto
// normal, a mensagem real chega inteira, sempre.
export async function gerarSugestaoCorteIA(): Promise<ResultadoSugestaoIA> {
  try {
    const [estado, movimentacaoDoMes, statusRateio] = await Promise.all([
      carregarEstadoAtual(),
      calcularMovimentacaoDoMes(inicioDoPeriodo("mes")),
      calcularStatusRateio(),
    ]);

    const prompt = gerarPromptCorteDeGastos(estado, movimentacaoDoMes, statusRateio);
    const texto = await chamarGemini(prompt);
    return { ok: true, texto };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha desconhecida ao gerar a sugestão." };
  }
}
