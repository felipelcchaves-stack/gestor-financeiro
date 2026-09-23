"use client";

import { useState } from "react";
import type { ResultadoSugestaoIA } from "@/app/resumo/ia/actions";

type Props = {
  acao: () => Promise<ResultadoSugestaoIA>;
  label: string;
  labelCarregando?: string;
};

export function SugestaoIA({ acao, label, labelCarregando = "Gerando…" }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const resposta = await acao();
      if (resposta.ok) {
        setResultado(resposta.texto);
      } else {
        setErro(resposta.erro);
      }
    } catch {
      // Só sobra aqui uma falha de rede real entre o navegador e o
      // próprio servidor (não da API do Gemini, essa já vem tratada
      // acima) — a action nunca lança exceção de propósito.
      setErro("Não consegui falar com o servidor. Recarregue a página e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={gerar}
        disabled={carregando}
        className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-60"
      >
        {carregando ? labelCarregando : label}
      </button>

      {erro && (
        <p className="rounded-lg border border-debt/30 bg-debt/[0.06] p-3 text-sm text-debt">{erro}</p>
      )}

      {resultado && (
        <div className="glass-card whitespace-pre-wrap rounded-2xl p-4 text-sm text-foreground">{resultado}</div>
      )}
    </div>
  );
}
