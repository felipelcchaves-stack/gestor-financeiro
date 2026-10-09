import Link from "next/link";
import { Wallet, TrendingDown, PiggyBank, Scale, Flame, Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import {
  somaAtivos,
  somaPassivosConhecidos,
  contarPassivosSemValorDocumentado,
  segmentarPorEstrutura,
  patrimonioLiquido,
  calcularProgressoMeta,
} from "@/lib/metrics";
import { StatusMeta } from "@/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import type { ComponentType } from "react";

export const dynamic = "force-dynamic";

export default async function ResumoPage() {
  const [passivos, ativos, contas, metas] = await Promise.all([
    prisma.passivo.findMany({ where: { status: "ATIVO" } }),
    prisma.ativo.findMany(),
    prisma.conta.findMany(),
    prisma.meta.findMany({
      where: { status: StatusMeta.ATIVA },
      include: {
        passivosAlvo: { include: { passivo: true } },
        alocacoes: true,
      },
    }),
  ]);

  const passivoTotal = somaPassivosConhecidos(passivos);
  const passivosSemValor = contarPassivosSemValorDocumentado(passivos);
  const segmentos = segmentarPorEstrutura(passivos);
  const ativoTotal = somaAtivos(ativos);
  const patrimonio = patrimonioLiquido(ativos, passivos);
  const contaComSaldo = contas.find((c) => c.saldoAtualCentavos != null);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Posição consolidada"
        title="Resumo completo"
        description="Dados de referência 09/09/2026."
        action={
          <Link href="/resumo/ia" className="text-xs text-gold underline underline-offset-4">
            Gerar resumo para revisar com IA
          </Link>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Saldo em conta"
          value={contaComSaldo ? formatarBRL(contaComSaldo.saldoAtualCentavos!) : "—"}
          hint={contaComSaldo ? undefined : "nenhum extrato importado ainda"}
          tone="neutral"
        />
        <MetricCard
          icon={TrendingDown}
          label="Passivo total"
          value={formatarBRL(passivoTotal)}
          hint={
            passivosSemValor > 0
              ? `${passivosSemValor} passivo(s) sem saldo total documentado`
              : undefined
          }
          tone="debt"
        />
        <MetricCard icon={PiggyBank} label="Ativos" value={formatarBRL(ativoTotal)} tone="liquidity" />
        <MetricCard
          icon={Scale}
          label="Patrimônio líquido"
          value={formatarBRL(patrimonio)}
          tone={patrimonio < 0 ? "debt" : "liquidity"}
          hint="ativos − passivos conhecidos"
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">Passivo por estrutura</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            icon={Flame}
            label="Sangria ativa (só juros)"
            value={formatarBRL(segmentos.sangriaAtiva)}
            hint="Agiota, Leka 1, Leka 2 — juros corre até quitar"
            tone="debt"
          />
          <MetricCard
            icon={TrendingDown}
            label="Amortizando normalmente"
            value={formatarBRL(segmentos.amortizando)}
            hint="consignados, empréstimos, financiamento, cartões"
            tone="neutral"
          />
          <MetricCard
            icon={Target}
            label="Sem sangria"
            value={formatarBRL(segmentos.semSangria)}
            hint="dívida de honra — sem juros"
            tone="neutral"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">Metas ativas</h2>
        {metas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma meta ativa cadastrada.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {metas.map((meta) => {
              const progresso = calcularProgressoMeta(
                meta,
                meta.passivosAlvo.map((mp) => mp.passivo),
                meta.alocacoes
              );
              const pct =
                progresso.valorFaltanteCentavos > 0
                  ? Math.min(
                      100,
                      Math.round((progresso.alocadoCentavos / progresso.valorFaltanteCentavos) * 100)
                    )
                  : 0;

              return (
                <div key={meta.id} className="glass-card rounded-2xl p-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-medium text-foreground">{meta.nome}</h3>
                    <span className="text-xs text-muted-foreground">
                      alvo: {new Date(meta.dataAlvo).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span>Falta: {formatarBRL(progresso.valorFaltanteCentavos)}</span>
                    <span>Alocado: {formatarBRL(progresso.alocadoCentavos)}</span>
                    {progresso.ritmoNecessarioCentavos != null && (
                      <span>
                        Ritmo necessário: {formatarBRL(progresso.ritmoNecessarioCentavos)}/mês
                      </span>
                    )}
                  </div>
                  {!progresso.temDadosDeAlocacao && (
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      Ainda sem lançamentos classificados para esta meta — sem dados para
                      projetar &ldquo;no ritmo&rdquo; vs &ldquo;atrasado&rdquo;.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const TONE_CLASSES: Record<"neutral" | "debt" | "liquidity", { icon: string; value: string }> = {
  neutral: { icon: "bg-muted text-foreground", value: "text-foreground" },
  debt: { icon: "bg-debt/10 text-debt", value: "num text-debt" },
  liquidity: { icon: "bg-liquidity/10 text-liquidity", value: "num text-liquidity" },
};

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "debt" | "liquidity";
}) {
  const classes = TONE_CLASSES[tone];

  return (
    <div className="glass-card rounded-2xl p-4">
      <span className={`flex size-8 items-center justify-center rounded-lg ${classes.icon}`}>
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${classes.value}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
