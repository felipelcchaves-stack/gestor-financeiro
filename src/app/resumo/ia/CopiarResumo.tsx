"use client";

import { useState } from "react";

export function CopiarResumo({ markdown }: { markdown: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          onClick={copiar}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          {copiado ? "Copiado!" : "Copiar resumo"}
        </button>
      </div>
      <textarea
        readOnly
        value={markdown}
        rows={24}
        className="w-full glass-card rounded-2xl p-4 font-mono text-xs text-foreground"
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  );
}
