"use client";

import { useState } from "react";
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
                <p className="whitespace-pre-wrap text-sm text-foreground">{analise.resumo}</p>
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
