"use client";

import { useState } from "react";
import { formatarBRL, parseNumeroBR } from "@/lib/money";
import { simularQuitacaoAVista, type ResultadoConsultor, type SimulacaoQuitacaoAVista } from "@/lib/consultor";

type PassivoOpcao = { id: string; nome: string; saldoCentavos: number };

export function SimuladorQuitacaoAVista({
  passivos,
  resultado,
}: {
  passivos: PassivoOpcao[];
  resultado: ResultadoConsultor;
}) {
  const [passivoId, setPassivoId] = useState(passivos[0]?.id ?? "");
  const [desconto, setDesconto] = useState("");
  const [simulacao, setSimulacao] = useState<SimulacaoQuitacaoAVista | null>(null);

  if (passivos.length === 0) return null;

  function simular() {
    const passivo = passivos.find((p) => p.id === passivoId);
    const descontoPct = parseNumeroBR(desconto);
    if (!passivo || descontoPct == null || descontoPct <= 0 || descontoPct >= 100) return;
    setSimulacao(simularQuitacaoAVista(passivo.saldoCentavos, descontoPct, resultado));
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-sm font-medium text-foreground">Simular quitação à vista com desconto</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Alguns credores oferecem abater um percentual do saldo pra quitar tudo de uma vez. Simula a economia literal
        do desconto, sem projetar juro futuro (o sistema não tem prazo/amortização documentados o suficiente pra
        isso).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={passivoId}
          onChange={(e) => setPassivoId(e.target.value)}
          className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
        >
          {passivos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({formatarBRL(p.saldoCentavos)})
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="decimal"
          value={desconto}
          onChange={(e) => setDesconto(e.target.value)}
          placeholder="desconto %"
          className="w-28 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={simular}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Simular
        </button>
      </div>

      {simulacao && (
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor de face</span>
            <span className="num text-foreground">{formatarBRL(simulacao.valorFaceCentavos)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor à vista com desconto</span>
            <span className="num font-medium text-liquidity">{formatarBRL(simulacao.valorAVistaCentavos)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Economia</span>
            <span className="num font-medium text-gold">{formatarBRL(simulacao.economiaCentavos)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{simulacao.recomendacao}</p>
        </div>
      )}
    </div>
  );
}
