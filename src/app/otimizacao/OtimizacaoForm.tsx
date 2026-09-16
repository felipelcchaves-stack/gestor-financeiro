"use client";

import { useMemo, useState, useTransition } from "react";
import {
  simularOrdem,
  simularOrdemComSplit,
  ordenarPorMenorTempo,
  ordenarPorMaiorAlivioCaixa,
  encontrarOrdemMenosJuros,
  montarOrdemHibrida,
  type PassivoParaOtimizacao,
  type ResultadoEstrategia,
  type EstrategiaId,
} from "@/lib/otimizacao";
import { formatarBRL, reaisParaCentavos, centavosParaReais, parseNumeroBR } from "@/lib/money";
import { TrajetoriaChart } from "./TrajetoriaChart";
import { definirEstrategiaEscolhida } from "./actions";

export function OtimizacaoForm({
  passivos,
  aporteInicialCentavos,
  estrategiaAtiva,
  splitHibridoPctAtivo,
}: {
  passivos: PassivoParaOtimizacao[];
  aporteInicialCentavos: number | null;
  estrategiaAtiva: string | null;
  splitHibridoPctAtivo: number | null;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(passivos.map((p) => p.id)));
  const [aporteReais, setAporteReais] = useState(
    aporteInicialCentavos != null ? String(centavosParaReais(aporteInicialCentavos)) : "10000"
  );
  const [aportePontualReais, setAportePontualReais] = useState("");
  const [splitPct, setSplitPct] = useState(splitHibridoPctAtivo ?? 50);

  const passivosSelecionados = passivos.filter((p) => selecionados.has(p.id));
  const aporteCentavos = reaisParaCentavos(parseNumeroBR(aporteReais) ?? 0);
  const aportePontualCentavos = reaisParaCentavos(parseNumeroBR(aportePontualReais) ?? 0);

  const resultados = useMemo(() => {
    if (passivosSelecionados.length < 2 || aporteCentavos <= 0) return null;

    const ordemTempo = ordenarPorMenorTempo(passivosSelecionados);
    const ordemCaixa = ordenarPorMaiorAlivioCaixa(passivosSelecionados);
    const { resultado: resultadoJuros, exaustivo } = encontrarOrdemMenosJuros(
      passivosSelecionados,
      aporteCentavos,
      aportePontualCentavos
    );
    const ordemHibrida = montarOrdemHibrida(passivosSelecionados);

    return {
      menorTempo: simularOrdem(passivosSelecionados, ordemTempo, aporteCentavos, 600, aportePontualCentavos),
      maiorAlivio: simularOrdem(passivosSelecionados, ordemCaixa, aporteCentavos, 600, aportePontualCentavos),
      menorJuros: resultadoJuros,
      hibrida: ordemHibrida
        ? simularOrdemComSplit(passivosSelecionados, ordemHibrida, splitPct, aporteCentavos, 600, aportePontualCentavos)
        : null,
      exaustivo,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionados, aporteCentavos, aportePontualCentavos, splitPct]);

  function alternar(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const nomePorId = new Map(passivos.map((p) => [p.id, p.nome]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-6 glass-card rounded-2xl p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Passivos a incluir</p>
          <div className="mt-2 flex flex-col gap-1">
            {passivos.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={selecionados.has(p.id)}
                  onChange={() => alternar(p.id)}
                />
                {p.nome}{" "}
                <span className="text-xs text-muted-foreground/70">
                  ({formatarBRL(p.saldoCentavos)}
                  {p.custoMensalCentavos > 0 ? ` · ${formatarBRL(p.custoMensalCentavos)}/mês` : ""})
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Aporte mensal extra disponível (R$)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={aporteReais}
            onChange={(e) => setAporteReais(e.target.value)}
            className="w-40 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
          <span className="text-[11px] text-muted-foreground/70">
            além dos pagamentos mínimos já em curso
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Aporte pontual (uma vez, R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={aportePontualReais}
            onChange={(e) => setAportePontualReais(e.target.value)}
            placeholder="ex: 5000"
            className="w-40 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
          <span className="text-[11px] text-muted-foreground/70">
            13º, restituição, bônus — entra só no primeiro mês, além do aporte mensal
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Divisão da estratégia híbrida (% pro mais difícil)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={splitPct}
            onChange={(e) => setSplitPct(Number(e.target.value))}
            className="w-40"
          />
          <span className="text-[11px] text-muted-foreground/70">
            {splitPct}% pro mais difícil (mais juro) · {100 - splitPct}% pro mais fácil (amortiza rápido)
          </span>
        </div>
      </div>

      {passivosSelecionados.length < 2 && (
        <p className="text-sm text-muted-foreground">Selecione ao menos 2 passivos para comparar estratégias.</p>
      )}
      {passivosSelecionados.length >= 2 && aporteCentavos <= 0 && (
        <p className="text-sm text-muted-foreground">Informe um aporte mensal extra maior que zero.</p>
      )}

      {resultados && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <CartaoEstrategia
            id="menorTempo"
            titulo="Critério 1 — menor tempo até zerar"
            descricao="ataca primeiro quem tem o menor saldo restante"
            resultado={resultados.menorTempo}
            nomePorId={nomePorId}
            estrategiaAtiva={estrategiaAtiva}
          />
          <CartaoEstrategia
            id="menorJuros"
            titulo="Critério 2 — menor juro total pago"
            descricao={
              resultados.exaustivo
                ? "busca exaustiva entre todas as ordens possíveis"
                : "heurística (mais de 7 passivos — não é busca exaustiva)"
            }
            resultado={resultados.menorJuros}
            nomePorId={nomePorId}
            estrategiaAtiva={estrategiaAtiva}
            destaque
          />
          <CartaoEstrategia
            id="maiorAlivio"
            titulo="Critério 3 — maior alívio de caixa mais rápido"
            descricao="ataca primeiro quem tem a maior parcela mensal"
            resultado={resultados.maiorAlivio}
            nomePorId={nomePorId}
            estrategiaAtiva={estrategiaAtiva}
          />
          {resultados.hibrida ? (
            <CartaoEstrategia
              id="hibrida"
              titulo="Critério 4 — híbrida (juro + alívio ao mesmo tempo)"
              descricao={`${splitPct}% do aporte pro mais difícil, ${100 - splitPct}% pro mais fácil, ao mesmo tempo — dá alívio visível todo mês sem abrir mão de atacar o mais caro`}
              resultado={resultados.hibrida}
              nomePorId={nomePorId}
              estrategiaAtiva={estrategiaAtiva}
              splitHibridoPct={splitPct}
            />
          ) : (
            <div className="flex flex-col items-start justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              A híbrida precisa de pelo menos 1 passivo binário (juro sem amortização, tipo Agiota) e 1 que amortiza
              normalmente pra fazer sentido dividir entre &ldquo;mais difícil&rdquo; e &ldquo;mais fácil&rdquo;.
            </div>
          )}
        </div>
      )}

      {resultados && (
        <TrajetoriaChart
          estrategias={[
            { nome: "Menor tempo", resultado: resultados.menorTempo, cor: "var(--liquidity)" },
            { nome: "Menor juro", resultado: resultados.menorJuros, cor: "var(--gold)" },
            { nome: "Maior alívio de caixa", resultado: resultados.maiorAlivio, cor: "var(--muted-foreground)", tracejado: true },
            ...(resultados.hibrida
              ? [{ nome: "Híbrida", resultado: resultados.hibrida, cor: "#8b5cf6" }]
              : []),
          ]}
        />
      )}

      {resultados && !resultados.menorJuros.convergiu && (
        <p className="text-xs text-gold">
          A simulação não convergiu em 50 anos com esse aporte — aumente o aporte mensal extra.
        </p>
      )}
    </div>
  );
}

function CartaoEstrategia({
  id,
  titulo,
  descricao,
  resultado,
  nomePorId,
  estrategiaAtiva,
  splitHibridoPct,
  destaque = false,
}: {
  id: EstrategiaId;
  titulo: string;
  descricao: string;
  resultado: ResultadoEstrategia;
  nomePorId: Map<string, string>;
  estrategiaAtiva: string | null;
  splitHibridoPct?: number;
  destaque?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const ativa = estrategiaAtiva === id;

  function usarEssaEstrategia() {
    const formData = new FormData();
    formData.set("estrategia", id);
    if (splitHibridoPct != null) formData.set("splitHibridoPct", String(splitHibridoPct));
    startTransition(() => {
      definirEstrategiaEscolhida(formData);
    });
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 ${
        ativa ? "border-liquidity/50 bg-liquidity/[0.05]" : destaque ? "border-gold/40 bg-surface" : "glass-card"
      }`}
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Tempo total</div>
          <div className="font-medium text-foreground">{resultado.mesesTotais} meses</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Juros total pago</div>
          <div className="font-medium text-debt">{formatarBRL(resultado.jurosTotalCentavos)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">1º alívio visível</div>
          <div className="font-medium text-foreground">
            {resultado.mesesAteAlivioVisivel != null ? `mês ${resultado.mesesAteAlivioVisivel}` : "—"}
          </div>
        </div>
      </div>

      {resultado.mesesNoEscuro.some((m) => m.meses > 0) && (
        <div className="rounded-lg border border-gold/20 bg-gold/[0.06] p-2 text-[11px] text-gold">
          {resultado.mesesNoEscuro
            .filter((m) => m.meses > 0)
            .map((m) => `${nomePorId.get(m.passivoId)} fica ${m.meses} ${m.meses === 1 ? "mês" : "meses"} sem nenhum progresso visível (só juro, até quitar de uma vez)`)
            .join(" · ")}
        </div>
      )}

      <ol className="flex flex-col gap-1 text-sm text-foreground">
        {resultado.ordemIds.map((pid, i) => {
          const quitacao = resultado.quitacoes.find((q) => q.passivoId === pid);
          return (
            <li key={pid} className="flex justify-between border-t border-border pt-1 first:border-0 first:pt-0">
              <span>
                {i + 1}. {nomePorId.get(pid)}
              </span>
              <span className="text-xs text-muted-foreground/70">
                {quitacao ? `quitado no mês ${quitacao.mes}` : "não quitado"}
              </span>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={usarEssaEstrategia}
        disabled={pending || ativa}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
          ativa
            ? "cursor-default bg-liquidity/15 text-liquidity"
            : "bg-primary text-primary-foreground hover:bg-primary/80"
        } disabled:opacity-60`}
      >
        {ativa ? "usando esse critério agora" : pending ? "aplicando…" : "usar esse critério no Mapa e no Consultor"}
      </button>
    </div>
  );
}
