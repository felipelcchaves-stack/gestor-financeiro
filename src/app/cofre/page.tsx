import Link from "next/link";
import { PiggyBank, Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarBRL, mesAnoDaquiA } from "@/lib/money";
import { calcularProgressoMeta } from "@/lib/metrics";
import { calcularStatusRateio } from "@/lib/rateio";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { criarMetaCofre } from "./actions";

export const dynamic = "force-dynamic";

export default async function CofrePage() {
  const estado = await carregarEstadoAtual();
  const statusRateio = await calcularStatusRateio(estado);

  const [metas, passivosDisponiveis] = await Promise.all([
    statusRateio
      ? prisma.meta.findMany({
          where: { contaOrigemId: statusRateio.contaDestinoId },
          include: { passivosAlvo: { include: { passivo: true } }, alocacoes: true },
          orderBy: { dataAlvo: "asc" },
        })
      : Promise.resolve([]),
    prisma.passivo.findMany({
      where: { status: "ATIVO" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, valorQuitacaoCentavos: true },
    }),
  ]);

  // Data-alvo real pra criar a meta sugerida com um clique — só existe
  // quando a rota de menor juro já foi simulada (aporte mensal extra
  // configurado em Consultor). Sem isso, não inventamos prazo nenhum.
  const dataAlvoSugeridaISO =
    statusRateio?.alvoSugerido?.mesQuitacaoProjetado != null
      ? new Date(
          estado.hoje.getFullYear(),
          estado.hoje.getMonth() + statusRateio.alvoSugerido.mesQuitacaoProjetado,
          1
        )
          .toISOString()
          .slice(0, 10)
      : null;
  const alvoJaEhQuitavel = statusRateio?.alvoSugerido?.passivoId === statusRateio?.dividaQuitavel?.passivoId;

  if (!statusRateio) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Ferramentas"
          title="Cofre"
          description="Reserva de receita separada especificamente pra quitar dívida."
        />
        <p className="text-sm text-muted-foreground">
          O rateio automático ainda não está configurado.{" "}
          <Link href="/consultor" className="text-gold underline underline-offset-4">
            Configure em Consultor
          </Link>{" "}
          (categoria de receita, % a separar e conta destino) pra começar a ver os indicadores aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Ferramentas"
        title="Cofre"
        description={`${statusRateio.percentual}% da receita de ${statusRateio.categoriaNome} separado pra ${statusRateio.contaDestinoNome}, pra quitar dívida.`}
      />

      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <PiggyBank className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wider">Indicadores</p>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo atual</p>
            <p className="num text-2xl font-semibold text-liquidity">
              {statusRateio.contaDestinoSaldoCentavos != null
                ? formatarBRL(statusRateio.contaDestinoSaldoCentavos)
                : "não informado"}
            </p>
            {statusRateio.contaDestinoSaldoAtualizadoEm && (
              <p className="text-[11px] text-muted-foreground/70">
                atualizado em {new Date(statusRateio.contaDestinoSaldoAtualizadoEm).toLocaleDateString("pt-BR")}{" "}
                — <Link href="/contas" className="underline underline-offset-4">atualizar</Link>
              </p>
            )}
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Separado desde {new Date(statusRateio.ativoDesde).toLocaleDateString("pt-BR")}
            </p>
            <p className="num text-2xl font-semibold text-foreground">{formatarBRL(statusRateio.totalDepositadoCentavos)}</p>
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Meta ({statusRateio.percentual}%)</p>
            <p className="num text-2xl font-semibold text-foreground">{formatarBRL(statusRateio.metaSepararCentavos)}</p>
            <p className="text-[11px] text-muted-foreground/70">
              de {formatarBRL(statusRateio.totalRecebidoCentavos)} recebidos de {statusRateio.categoriaNome}
            </p>
          </div>
          {statusRateio.faltaSepararCentavos > 0 && (
            <div className="border-l border-dashed border-border pl-8">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Falta separar</p>
              <p className="num text-2xl font-semibold text-gold">{formatarBRL(statusRateio.faltaSepararCentavos)}</p>
            </div>
          )}
        </div>

        {statusRateio.dividaQuitavel && (
          <p className="mt-4 rounded-lg border border-debt/30 bg-debt/[0.06] p-3 text-sm text-debt">
            Esse saldo já cobre{" "}
            <Link href={`/passivos/${statusRateio.dividaQuitavel.passivoId}`} className="font-medium underline underline-offset-4">
              {statusRateio.dividaQuitavel.nome}
            </Link>{" "}
            ({formatarBRL(statusRateio.dividaQuitavel.valorQuitacaoCentavos)}) inteira — a próxima da rota de menor
            juro entre as que cabem no saldo.
          </p>
        )}

        {statusRateio.alvoSugerido && !alvoJaEhQuitavel && (
          <div className="mt-4 rounded-lg border border-gold/30 bg-gold/[0.06] p-4">
            <p className="text-sm text-gold">
              O alvo mais eficiente pra essa reserva agora é{" "}
              <Link
                href={`/passivos/${statusRateio.alvoSugerido.passivoId}`}
                className="font-medium underline underline-offset-4"
              >
                {statusRateio.alvoSugerido.nome}
              </Link>{" "}
              — é a próxima dívida na rota de menor juro (custo mensal{" "}
              {formatarBRL(statusRateio.alvoSugerido.custoMensalCentavos)}, saldo{" "}
              {formatarBRL(statusRateio.alvoSugerido.valorQuitacaoCentavos)}). Faltam{" "}
              {formatarBRL(statusRateio.alvoSugerido.faltaParaQuitarCentavos)} pro cofre cobrir ela inteira
              {statusRateio.alvoSugerido.mesQuitacaoProjetado != null &&
                ` — a rota atual projeta quitação em ${mesAnoDaquiA(statusRateio.alvoSugerido.mesQuitacaoProjetado)}`}
              .
            </p>
            {dataAlvoSugeridaISO ? (
              <form action={criarMetaCofre.bind(null, statusRateio.contaDestinoId)} className="mt-3">
                <input type="hidden" name="passivosAlvo" value={statusRateio.alvoSugerido.passivoId} />
                <input type="hidden" name="nome" value={`Quitar ${statusRateio.alvoSugerido.nome}`} />
                <input type="hidden" name="dataAlvo" value={dataAlvoSugeridaISO} />
                <Button type="submit" size="sm" variant="outline">
                  Criar meta pra esse alvo
                </Button>
              </form>
            ) : (
              <p className="mt-2 text-xs text-gold/80">
                Configure um aporte mensal extra em{" "}
                <Link href="/consultor" className="underline underline-offset-4">
                  Consultor
                </Link>{" "}
                pra ver a data projetada e criar essa meta com um clique.
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Target className="size-4 text-gold" /> Metas financiadas por este cofre
          </h2>
        </div>

        {metas.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma meta cadastrada pra esse cofre ainda.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {metas.map((meta) => {
              const progresso = calcularProgressoMeta(
                meta,
                meta.passivosAlvo.map((mp) => mp.passivo),
                meta.alocacoes
              );
              // Progresso à parte, baseado no saldo real do cofre — o
              // valorFaltanteCentavos acima já reflete o saldo do
              // passivo (se documentado); este é literalmente "quanto
              // do que já tenho guardado aqui cobre essa meta",
              // crescendo à medida que o saldo do Bradesco sobe.
              const saldoCofreCentavos = statusRateio.contaDestinoSaldoCentavos ?? 0;
              const progressoCofrePct =
                meta.valorAlvoCentavos > 0
                  ? Math.min(100, Math.round((saldoCofreCentavos / meta.valorAlvoCentavos) * 100))
                  : 0;
              return (
                <div key={meta.id} className="glass-card rounded-2xl p-5">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-base font-medium text-foreground">{meta.nome}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        meta.status === "ATIVA" ? "bg-liquidity/[0.06] text-liquidity" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {meta.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Data-alvo: {new Date(meta.dataAlvo).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Falta {formatarBRL(progresso.valorFaltanteCentavos)}
                    {progresso.ritmoNecessarioCentavos != null && `, ritmo necessário ${formatarBRL(progresso.ritmoNecessarioCentavos)}/mês`}
                  </p>

                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                      <span>Coberto pelo saldo do cofre</span>
                      <span className="num">{progressoCofrePct}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${progressoCofrePct >= 100 ? "bg-liquidity" : "bg-gold"}`}
                        style={{ width: `${progressoCofrePct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {formatarBRL(saldoCofreCentavos)} de {formatarBRL(meta.valorAlvoCentavos)} — sobe conforme o
                      saldo de {statusRateio.contaDestinoNome} for atualizado.
                    </p>
                  </div>

                  <Link href="/metas" className="mt-2 inline-block text-xs text-gold underline underline-offset-4">
                    editar em Metas
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-gold underline underline-offset-4">
            Nova meta financiada por este cofre
          </summary>
          <form
            action={criarMetaCofre.bind(null, statusRateio.contaDestinoId)}
            className="mt-3 flex flex-col gap-4 glass-card rounded-2xl p-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Nome</label>
                <input
                  name="nome"
                  required
                  className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Valor-alvo (R$) — opcional se marcar passivo-alvo com saldo documentado
                </label>
                <input
                  name="valorAlvo"
                  type="text"
                  inputMode="decimal"
                  className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Data-alvo</label>
                <input
                  name="dataAlvo"
                  type="date"
                  required
                  className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Passivos-alvo</label>
              <div className="mt-1 flex flex-col gap-1 rounded border border-border p-2">
                {passivosDisponiveis.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" name="passivosAlvo" value={p.id} />
                    {p.nome}
                    {p.valorQuitacaoCentavos != null && (
                      <span className="text-muted-foreground">— {formatarBRL(p.valorQuitacaoCentavos)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Button type="submit">Criar meta</Button>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}
