"use server";

import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularMovimentacaoDoMes, inicioDoPeriodo } from "@/lib/ofensores";
import { calcularStatusRateio } from "@/lib/rateio";
import { gerarPromptCorteDeGastos } from "@/lib/promptCorteDeGastos";
import { chamarGemini } from "@/lib/gemini";

// Erros aqui (chave ausente, API fora, timeout) chegam como Error com
// mensagem legível — o componente cliente que chama isso SEMPRE
// precisa envolver essa chamada em try/catch (ver SugestaoIA.tsx).
// Um form action puro deixando isso vazar sem tratamento foi
// exatamente o bug corrigido no formulário do rateio.
export async function gerarSugestaoCorteIA(): Promise<string> {
  const [estado, movimentacaoDoMes, statusRateio] = await Promise.all([
    carregarEstadoAtual(),
    calcularMovimentacaoDoMes(inicioDoPeriodo("mes")),
    calcularStatusRateio(),
  ]);

  const prompt = gerarPromptCorteDeGastos(estado, movimentacaoDoMes, statusRateio);
  return chamarGemini(prompt);
}
