import { formatarBRL, mesAnoDaquiA } from "@/lib/money";

export type Estacao = {
  id: string;
  nome: string;
  saldoCentavos: number;
  status: "quitado" | "atual" | "fila";
  mesEstimado: number | null;
};

// Design system "Vimeo": cartões brancos sem borda; o significado fica no pontinho colorido + palavra.
const ESTILO_POR_STATUS: Record<Estacao["status"], { cartao: string; ponto: string; rotulo: string }> = {
  quitado: { cartao: "bg-card", ponto: "bg-liquidity", rotulo: "quitado" },
  atual: { cartao: "bg-card ring-2 ring-foreground", ponto: "bg-gold", rotulo: "atacando agora" },
  fila: { cartao: "bg-card", ponto: "bg-border-strong", rotulo: "na fila" },
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
                className={`m-0.5 flex w-44 flex-col gap-1 rounded-2xl p-4 ${estilo.cartao}`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${estilo.ponto}`} />
                  {estilo.rotulo}
                </span>
                <span className="text-sm font-medium text-foreground">{estacao.nome}</span>
                <span className="num text-xs text-muted-foreground">{formatarBRL(estacao.saldoCentavos)}</span>
                {estacao.status !== "quitado" && estacao.mesEstimado != null && (
                  <span className="text-xs text-muted-foreground">
                    previsão: {mesAnoDaquiA(estacao.mesEstimado)}
                  </span>
                )}
              </div>
              {i < estacoes.length - 1 && (
                <div className="flex w-8 shrink-0 flex-col items-center justify-center text-muted-foreground">
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
