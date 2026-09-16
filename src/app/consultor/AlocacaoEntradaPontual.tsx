"use client";

import { useState } from "react";
import { formatarBRL, reaisParaCentavos, parseNumeroBR } from "@/lib/money";
import { alocarEntradaPontual, type ResultadoConsultor, type DestinoEntradaPontual } from "@/lib/consultor";
import { Button } from "@/components/ui/button";

const DESTINO_LABEL: Record<DestinoEntradaPontual["destino"], string> = {
  RESERVA: "Reserva de emergência",
  PASSIVO: "Quitar dívida",
  INVESTIR: "Investir",
};

const DESTINO_CLASSES: Record<DestinoEntradaPontual["destino"], string> = {
  RESERVA: "text-gold",
  PASSIVO: "text-debt",
  INVESTIR: "text-liquidity",
};

export function AlocacaoEntradaPontual({ resultado }: { resultado: ResultadoConsultor }) {
  const [valor, setValor] = useState("");
  const [alocacoes, setAlocacoes] = useState<DestinoEntradaPontual[] | null>(null);

  function simular() {
    const valorCentavos = reaisParaCentavos(parseNumeroBR(valor) ?? 0);
    if (valorCentavos <= 0) return;
    setAlocacoes(alocarEntradaPontual(valorCentavos, resultado));
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-sm font-medium text-foreground">Recebi um valor avulso</p>
      <p className="mt-1 text-xs text-muted-foreground">
        13º, restituição, bônus — simula pra onde esse dinheiro deveria ir, na mesma ordem de prioridade dos
        vereditos acima.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="ex: 3000"
          className="w-32 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
        />
        <Button type="button" size="sm" onClick={simular}>
          Simular
        </Button>
      </div>

      {alocacoes && (
        <ul className="mt-4 flex flex-col gap-2">
          {alocacoes.map((a, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {DESTINO_LABEL[a.destino]}
                {a.destino === "PASSIVO" && <> — {a.detalhe}</>}
              </span>
              <span className={`num font-medium ${DESTINO_CLASSES[a.destino]}`}>{formatarBRL(a.valorCentavos)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
