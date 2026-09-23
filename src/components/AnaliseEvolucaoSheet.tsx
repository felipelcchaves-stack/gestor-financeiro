"use client";

import { useState } from "react";
import { ListChecks, AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EvolucaoMensalChart } from "@/components/EvolucaoMensalChart";
import type { PontoEvolucaoMensal } from "@/lib/ofensores";
import type { AnaliseEvolucao, ResultadoAnaliseEvolucao } from "@/app/(mapa)/actions";

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

type Props = {
  sugestaoInicial: AnaliseEvolucao | null;
  pontos: PontoEvolucaoMensal[];
  acaoGerar: () => Promise<ResultadoAnaliseEvolucao>;
};

export function AnaliseEvolucaoSheet({ sugestaoInicial, pontos, acaoGerar }: Props) {
  const [analise, setAnalise] = useState<AnaliseEvolucao | null>(sugestaoInicial);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await acaoGerar();
      if (resposta.ok) {
        setAnalise(resposta);
        setAberto(true);
      } else {
        setErro(resposta.erro);
      }
    } catch {
      setErro("Não consegui falar com o servidor. Recarregue a página e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {analise && (
        <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
          Ver última análise ({formatarDataHora(analise.geradoEm)})
        </Button>
      )}
      <Button type="button" size="sm" onClick={gerar} disabled={carregando}>
        {carregando ? "Gerando…" : analise ? "Gerar nova análise (IA)" : "Pedir análise da IA"}
      </Button>

      {erro && <p className="w-full rounded-lg border border-debt/30 bg-debt/[0.06] p-3 text-xs text-debt">{erro}</p>}

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Evolução mensal — análise da IA</SheetTitle>
            {analise && <SheetDescription>Gerado em {formatarDataHora(analise.geradoEm)}</SheetDescription>}
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4">
            {analise ? (
              <>
                <p className="whitespace-pre-wrap text-sm text-foreground">{analise.tendencia}</p>

                {analise.acoesPrioritarias.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ListChecks className="size-4 text-gold" /> Ações prioritárias
                    </h3>
                    <ol className="flex flex-col gap-2">
                      {analise.acoesPrioritarias.map((acao, indice) => (
                        <li key={indice} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="font-semibold text-gold">{indice + 1}.</span>
                          <span>{acao}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {analise.pontosAtencao.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <AlertTriangle className="size-4 text-debt" /> Pontos de atenção
                    </h3>
                    <div className="flex flex-col gap-2">
                      {analise.pontosAtencao.map((ponto, indice) => (
                        <div key={indice} className="rounded-2xl border border-debt/25 bg-debt/[0.06] p-3">
                          <p className="text-sm font-medium text-foreground">{ponto.item}</p>
                          <div className="mt-2 flex items-start gap-2 rounded-xl bg-gold/10 p-2.5">
                            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-gold" />
                            <p className="text-xs text-foreground/90">{ponto.dica}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analise.pontosPositivos.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <TrendingUp className="size-4 text-liquidity" /> Pontos positivos
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {analise.pontosPositivos.map((ponto, indice) => (
                        <li key={indice} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="text-liquidity">●</span>
                          <span>{ponto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <EvolucaoMensalChart pontos={pontos} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nada gerado ainda.</p>
            )}
          </div>

          <SheetFooter>
            <p className="text-[11px] text-muted-foreground/70">
              Envia os totais de entrada/despesa por mês e o detalhamento por categoria do mês atual (nunca suas
              transações individuais) pra API do Claude (Anthropic). Tem custo por chamada.
            </p>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
