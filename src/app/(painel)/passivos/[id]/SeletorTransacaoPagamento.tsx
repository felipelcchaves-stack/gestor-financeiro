"use client";

import { useMemo, useState } from "react";
import { formatarBRL } from "@/lib/money";

type TransacaoCandidata = { id: string; data: Date | string; descricao: string; valorCentavos: number };

// Com centenas de transações candidatas (sem take/limite no servidor —
// ver page.tsx), um <select> não filtrado é inutilizável. Este campo de
// busca filtra no navegador por descrição/valor, sem precisar de mais
// nenhuma ida ao servidor.
export function SeletorTransacaoPagamento({ transacoes }: { transacoes: TransacaoCandidata[] }) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return transacoes;
    return transacoes.filter((t) => {
      const dataFormatada = new Date(t.data).toLocaleDateString("pt-BR");
      const valorFormatado = formatarBRL(t.valorCentavos).toLowerCase();
      return (
        t.descricao.toLowerCase().includes(termo) ||
        dataFormatada.includes(termo) ||
        valorFormatado.includes(termo)
      );
    });
  }, [busca, transacoes]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">Transação de pagamento</label>
      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="buscar por descrição, data ou valor…"
        className="w-80 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
      />
      <select
        name="transacaoId"
        required
        size={Math.min(8, Math.max(4, filtradas.length))}
        className="w-80 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
      >
        <option value="">selecione…</option>
        {filtradas.map((t) => (
          <option key={t.id} value={t.id}>
            {new Date(t.data).toLocaleDateString("pt-BR")} — {t.descricao} — {formatarBRL(t.valorCentavos)}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground/70">
        {filtradas.length} de {transacoes.length} transação(ões){busca ? " (filtradas)" : ""}
      </p>
    </div>
  );
}
