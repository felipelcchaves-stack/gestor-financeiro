import { formatarBRL, mesAnoDaquiA } from "@/lib/money";

export type Estacao = {
  id: string;
  nome: string;
  saldoCentavos: number;
  status: "quitado" | "atual" | "fila";
  mesEstimado: number | null;
};

const ESTILO_POR_STATUS: Record<Estacao["status"], { borda: string; fundo: string; texto: string; rotulo: string }> = {
  quitado: {
    borda: "border-liquidity/30",
    fundo: "bg-liquidity/[0.08]",
    texto: "text-liquidity",
    rotulo: "quitado",
  },
  atual: {
    borda: "border-gold/50",
    fundo: "bg-gold/[0.08]",
    texto: "text-gold",
    rotulo: "atacando agora",
  },
  fila: {
    borda: "border-border",
    fundo: "bg-surface",
    texto: "text-muted-foreground",
    rotulo: "na fila",
  },
};

export function TrilhaDeSaida({ estacoes }: { estacoes: Estacao[] }) {
  if (estacoes.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-stretch gap-0">
        {estacoes.map((estacao, i) => {
          const estilo = ESTILO_POR_STATUS[estacao.status];
          return (
            <div key={estacao.id} className="flex items-center">
              <div
                className={`flex w-44 flex-col gap-1 rounded-2xl border-2 p-3 ${estilo.borda} ${estilo.fundo}`}
              >
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${estilo.texto}`}>
                  {estilo.rotulo}
                </span>
                <span className="text-sm font-medium text-foreground">{estacao.nome}</span>
                <span className="num text-xs text-muted-foreground">{formatarBRL(estacao.saldoCentavos)}</span>
                {estacao.status !== "quitado" && estacao.mesEstimado != null && (
                  <span className="text-[11px] text-muted-foreground/70">
                    previsão: {mesAnoDaquiA(estacao.mesEstimado)}
                  </span>
                )}
              </div>
              {i < estacoes.length - 1 && (
                <div className="flex w-8 shrink-0 flex-col items-center justify-center text-muted-foreground/50">
                  <span aria-hidden>→</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
