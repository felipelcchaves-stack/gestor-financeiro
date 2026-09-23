"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatarBRL } from "@/lib/money";
import { CorteSugeridoChart } from "@/components/CorteSugeridoChart";
import type { ResultadoSugestaoIA, SugestaoGerada } from "@/app/resumo/ia/actions";

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function ComparacaoTabela({ comparacao }: { comparacao: NonNullable<SugestaoGerada["comparacao"]> }) {
  if (comparacao.categorias.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        Desde a análise de {formatarDataHora(comparacao.analisadaEmAnterior)}
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-left uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Categoria</th>
              <th className="px-2 py-2 text-right font-medium">Antes</th>
              <th className="px-2 py-2 text-right font-medium">Agora</th>
              <th className="px-3 py-2 text-right font-medium">Variação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {comparacao.categorias.map((c) => (
              <tr key={c.categoria}>
                <td className="px-3 py-2 text-foreground">{c.categoria}</td>
                <td className="num px-2 py-2 text-right text-muted-foreground">{formatarBRL(c.antesCentavos)}</td>
                <td className="num px-2 py-2 text-right text-muted-foreground">{formatarBRL(c.agoraCentavos)}</td>
                <td
                  className={`num px-3 py-2 text-right font-medium ${
                    c.variacaoCentavos > 0 ? "text-debt" : c.variacaoCentavos < 0 ? "text-liquidity" : "text-muted-foreground"
                  }`}
                >
                  {c.variacaoCentavos > 0 ? "+" : ""}
                  {formatarBRL(c.variacaoCentavos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjecaoBanner({ projecao }: { projecao: NonNullable<SugestaoGerada["projecao"]> }) {
  if (projecao.faltaParaQuitarCentavos === 0) {
    return (
      <div className="rounded-lg border border-liquidity/30 bg-liquidity/[0.06] p-3 text-sm text-liquidity">
        O saldo já separado no cofre ({formatarBRL(projecao.saldoJaSeparadoCentavos)}) já cobre essa meta inteira —
        já dá pra quitar agora, mesmo sem nenhum corte novo.
      </div>
    );
  }

  if (projecao.mesesEstimados == null) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
        Faltam {formatarBRL(projecao.faltaParaQuitarCentavos)} pra fechar essa meta (saldo já separado:{" "}
        {formatarBRL(projecao.saldoJaSeparadoCentavos)}). A IA não sugeriu nenhum corte com valor dessa vez, então
        não dá pra projetar um prazo.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gold/30 bg-gold/[0.06] p-3 text-sm text-gold">
      Se todos os cortes abaixo forem feitos ({formatarBRL(projecao.totalLiberadoMensalCentavos)}/mês) — considerando
      o saldo real já separado no cofre agora ({formatarBRL(projecao.saldoJaSeparadoCentavos)}) — faltam{" "}
      {formatarBRL(projecao.faltaParaQuitarCentavos)}, o que fecha em <strong>~{projecao.mesesEstimados}{" "}
      {projecao.mesesEstimados === 1 ? "mês" : "meses"}</strong>.
    </div>
  );
}

type Props = {
  sugestaoInicial: SugestaoGerada | null;
  acaoGerar: () => Promise<ResultadoSugestaoIA>;
  titulo: string;
};

export function SugestaoIA({ sugestaoInicial, acaoGerar, titulo }: Props) {
  const [sugestao, setSugestao] = useState<SugestaoGerada | null>(sugestaoInicial);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await acaoGerar();
      if (resposta.ok) {
        setSugestao(resposta);
        setAberto(true);
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {sugestao && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
            Ver última análise (gerada em {formatarDataHora(sugestao.geradoEm)})
          </Button>
        )}
        <Button type="button" size="sm" onClick={gerar} disabled={carregando}>
          {carregando ? "Gerando…" : sugestao ? "Gerar novo corte agressivo (IA)" : "Gerar sugestão com IA (Gemini)"}
        </Button>
      </div>

      {erro && <p className="rounded-lg border border-debt/30 bg-debt/[0.06] p-3 text-xs text-debt">{erro}</p>}

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{titulo}</SheetTitle>
            {sugestao && <SheetDescription>Gerado em {formatarDataHora(sugestao.geradoEm)}</SheetDescription>}
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4">
            {sugestao ? (
              <>
                {sugestao.projecao && <ProjecaoBanner projecao={sugestao.projecao} />}
                <p className="whitespace-pre-wrap text-sm text-foreground">{sugestao.resumo}</p>
                {sugestao.comparacao && <ComparacaoTabela comparacao={sugestao.comparacao} />}
                <CorteSugeridoChart cortes={sugestao.cortes} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nada gerado ainda.</p>
            )}
          </div>

          <SheetFooter>
            <p className="text-[11px] text-muted-foreground/70">
              Envia os totais por categoria e o custo mensal de cada dívida (nunca suas transações individuais) pra
              API do Gemini (Google). Tem custo por chamada e os dados saem da sua máquina.
            </p>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
