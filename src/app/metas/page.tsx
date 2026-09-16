import Link from "next/link";
import { Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import { calcularProgressoMeta } from "@/lib/metrics";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ConfirmForm";
import { excluirMeta } from "./actions";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  const metas = await prisma.meta.findMany({
    include: {
      passivosAlvo: { include: { passivo: true } },
      alocacoes: true,
    },
    orderBy: { dataAlvo: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Metas"
        description="Um objetivo de quitação, tipo “zerar tal dívida até tal data”. O sistema te diz se o ritmo atual é suficiente."
        action={
          <Button nativeButton={false} render={<Link href="/metas/novo" />}>
            <Target className="size-4" /> Nova meta
          </Button>
        }
      />
      <p className="-mt-4 text-xs text-muted-foreground">{metas.length} meta(s) cadastrada(s)</p>

      {metas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {metas.map((meta) => {
            const progresso = calcularProgressoMeta(
              meta,
              meta.passivosAlvo.map((mp) => mp.passivo),
              meta.alocacoes
            );

            return (
              <div key={meta.id} className="glass-card rounded-2xl p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-base font-medium text-foreground">{meta.nome}</h2>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        meta.status === "ATIVA"
                          ? "bg-liquidity/[0.06] text-liquidity"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {meta.status}
                    </span>
                    <Link href={`/metas/${meta.id}/editar`} className="text-xs text-muted-foreground/70 hover:text-foreground">
                      editar
                    </Link>
                    <ConfirmForm
                      action={excluirMeta.bind(null, meta.id)}
                      confirmMessage={`Excluir a meta "${meta.nome}"? Essa ação não pode ser desfeita.`}
                    >
                      <button type="submit" className="text-xs text-muted-foreground/70 hover:text-debt">
                        excluir
                      </button>
                    </ConfirmForm>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Alvo: {meta.passivosAlvo.map((mp) => mp.passivo.nome).join(", ")} · Data-alvo:{" "}
                  {new Date(meta.dataAlvo).toLocaleDateString("pt-BR")}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Metric label="Falta" value={formatarBRL(progresso.valorFaltanteCentavos)} />
                  <Metric label="Alocado" value={formatarBRL(progresso.alocadoCentavos)} />
                  <Metric
                    label="Meses restantes"
                    value={progresso.mesesRestantes.toFixed(1)}
                  />
                  <Metric
                    label="Ritmo necessário"
                    value={
                      progresso.ritmoNecessarioCentavos != null
                        ? `${formatarBRL(progresso.ritmoNecessarioCentavos)}/mês`
                        : "data-alvo vencida"
                    }
                  />
                </dl>

                {!progresso.temDadosDeAlocacao && (
                  <p className="mt-3 text-xs text-muted-foreground/70">
                    Ainda sem lançamentos classificados como alocação para esta meta. O
                    indicador de &ldquo;no ritmo&rdquo; / &ldquo;atrasado&rdquo; fica disponível
                    assim que houver dados reais de aporte (importação de extrato +
                    classificação).
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
