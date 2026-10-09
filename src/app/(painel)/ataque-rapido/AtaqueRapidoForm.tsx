"use client";

import { useMemo, useState } from "react";
import { simularOrdem, ordenarPorMaiorAlivioCaixa, type PassivoParaOtimizacao } from "@/lib/otimizacao";
import { formatarBRL, reaisParaCentavos, centavosParaReais, mesAnoDaquiA, parseNumeroBR } from "@/lib/money";

type PassivoComTamanho = PassivoParaOtimizacao & { grande: boolean };

function formatarMeses(n: number): string {
  return n === 1 ? "1 mês" : `${n} meses`;
}

export function AtaqueRapidoForm({
  passivos,
  aporteInicialCentavos,
}: {
  passivos: PassivoComTamanho[];
  aporteInicialCentavos: number | null;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(
    new Set(passivos.filter((p) => !p.grande).map((p) => p.id))
  );
  const [aporteReais, setAporteReais] = useState(
    aporteInicialCentavos != null ? String(centavosParaReais(aporteInicialCentavos)) : "2000"
  );

  const passivosSelecionados = passivos.filter((p) => selecionados.has(p.id));
  const aporteCentavos = reaisParaCentavos(parseNumeroBR(aporteReais) ?? 0);

  const resultado = useMemo(() => {
    if (passivosSelecionados.length === 0 || aporteCentavos <= 0) return null;
    const ordem = ordenarPorMaiorAlivioCaixa(passivosSelecionados);
    return simularOrdem(passivosSelecionados, ordem, aporteCentavos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionados, aporteCentavos]);

  function alternar(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const nomePorId = new Map(passivos.map((p) => [p.id, p]));
  const alivioTotalCentavos = passivosSelecionados.reduce((acc, p) => acc + p.custoMensalCentavos, 0);
  const chaveAnimacao = `${Array.from(selecionados).sort().join(",")}-${aporteCentavos}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-6 glass-card rounded-2xl p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Dívidas na mira</p>
          <div className="mt-2 flex flex-col gap-1">
            {passivos.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => alternar(p.id)} />
                {p.nome}{" "}
                <span className="text-xs text-muted-foreground/70">
                  ({formatarBRL(p.saldoCentavos)}
                  {p.custoMensalCentavos > 0 ? ` · ${formatarBRL(p.custoMensalCentavos)}/mês` : ""})
                </span>
                {p.grande && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">grande</span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Quanto você pode direcionar por mês (R$)</label>
          <input
            type="range"
            min={0}
            max={20000}
            step={100}
            value={parseNumeroBR(aporteReais) ?? 0}
            onChange={(e) => setAporteReais(e.target.value)}
            className="w-56"
          />
          <input
            type="text"
            inputMode="decimal"
            value={aporteReais}
            onChange={(e) => setAporteReais(e.target.value)}
            className="w-32 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </div>
      </div>

      {passivosSelecionados.length === 0 && (
        <p className="text-sm text-muted-foreground">Marque ao menos uma dívida pra simular.</p>
      )}
      {passivosSelecionados.length > 0 && aporteCentavos <= 0 && (
        <p className="text-sm text-muted-foreground">Informe um valor de aporte maior que zero.</p>
      )}

      {resultado && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-liquidity/25 bg-liquidity/[0.06] p-4 text-sm text-liquidity">
            Atacando nessa ordem, todas essas dívidas somem em{" "}
            <span className="font-semibold">{formatarMeses(resultado.mesesTotais)}</span> — liberando{" "}
            <span className="font-semibold">{formatarBRL(alivioTotalCentavos)}/mês</span> no seu caixa quando
            a última cair.
          </div>

          <div key={chaveAnimacao} className="flex flex-col gap-3">
            {resultado.ordemIds.map((id, i) => {
              const p = nomePorId.get(id)!;
              const quitacao = resultado.quitacoes.find((q) => q.passivoId === id);
              return (
                <div
                  key={id}
                  className="animar-tombar flex items-center justify-between glass-card rounded-2xl p-4"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {i + 1}. {p.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatarBRL(p.saldoCentavos)} de saldo</p>
                  </div>
                  <div className="text-right">
                    {quitacao ? (
                      <>
                        <p className="text-sm font-semibold text-liquidity">
                          vira pó em {formatarMeses(quitacao.mes)}
                        </p>
                        <p className="text-xs text-muted-foreground/70">({mesAnoDaquiA(quitacao.mes)})</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground/70">não fecha no período simulado</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!resultado.convergiu && (
            <p className="text-xs text-gold">
              Com esse aporte, nem todas fecham em 50 anos — aumente o valor mensal pra ver o efeito.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
