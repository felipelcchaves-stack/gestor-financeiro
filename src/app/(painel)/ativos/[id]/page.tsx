import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import { vincularAtivoPassivo, removerVinculo, excluirAtivo } from "../actions";
import { calcularArbitragemGarantia } from "@/lib/arbitragemGarantia";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ConfirmForm";

export default async function AtivoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ativo, passivos] = await Promise.all([
    prisma.ativo.findUnique({
      where: { id },
      include: {
        vinculos: { include: { passivo: true } },
        historico: { orderBy: { registradoEm: "desc" } },
      },
    }),
    prisma.passivo.findMany({ where: { status: "ATIVO" }, orderBy: { nome: "asc" } }),
  ]);
  if (!ativo) notFound();

  // Quanto do valor real deste ativo está preso garantindo dívidas ainda
  // ativas vs. já livre (dívidas cujo vínculo é GARANTIA já foram
  // quitadas). Cálculo feito na leitura — nunca altera valorCentavos do
  // ativo, que continua sendo só o que está documentado de verdade.
  const vinculosGarantia = ativo.vinculos.filter(
    (v) => v.tipoVinculo === "GARANTIA" && v.valorGarantidoCentavos != null
  );
  const presoCentavos = vinculosGarantia
    .filter((v) => v.passivo.status === "ATIVO")
    .reduce((soma, v) => soma + (v.valorGarantidoCentavos ?? 0), 0);
  const livreCentavos = ativo.valorCentavos - presoCentavos;

  const arbitragem = calcularArbitragemGarantia([ativo])[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{ativo.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatarBRL(ativo.valorCentavos)} · liquidez {ativo.liquidez}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/ativos/${id}/editar`} className="rounded border border-input px-3 py-1.5 text-sm">
            Editar
          </Link>
          <ConfirmForm
            action={excluirAtivo.bind(null, id)}
            confirmMessage={`Excluir o ativo "${ativo.nome}"? Essa ação não pode ser desfeita.`}
          >
            <Button type="submit" variant="destructive" size="sm">
              Excluir
            </Button>
          </ConfirmForm>
        </div>
      </div>

      {ativo.observacao && (
        <p className="rounded-lg border border-gold/20 bg-gold/[0.06] p-3 text-sm text-gold">
          {ativo.observacao}
        </p>
      )}

      {vinculosGarantia.length > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Preso em garantia (dívidas ativas)</div>
            <div className="font-medium text-debt">{formatarBRL(presoCentavos)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Livre</div>
            <div className="font-medium text-foreground">{formatarBRL(livreCentavos)}</div>
          </div>
        </div>
      )}

      {arbitragem && (
        <div className="rounded-lg border border-debt/30 bg-debt/[0.06] p-4">
          <p className="text-sm text-debt">
            Rendendo {arbitragem.rendimentoMensalPct}% a.m., isso está te custando{" "}
            <span className="font-semibold">{formatarBRL(arbitragem.custoMensalTotalCentavos)}/mês</span> — as
            dívidas abaixo custam mais juro do que esse investimento rende. Resgatar e quitar economiza essa
            diferença todo mês.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {arbitragem.oportunidades.map((o) => (
              <li key={o.passivoId} className="flex items-center justify-between text-sm">
                <Link href={`/passivos/${o.passivoId}`} className="text-foreground underline underline-offset-4">
                  {o.passivoNome}
                </Link>
                <span className="text-xs text-debt">
                  {o.taxaJurosPct}% a.m. — custa {formatarBRL(o.custoMensalCentavos)}/mês a mais do que rende
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-foreground">Vinculação a passivos</h2>
        {ativo.vinculos.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {ativo.vinculos.map((v) => {
              const financiado = v.tipoVinculo === "FINANCIAMENTO";
              const garantiaLiberada = v.tipoVinculo === "GARANTIA" && v.passivo.status !== "ATIVO";
              return (
                <li key={v.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={financiado ? "text-debt" : garantiaLiberada ? "text-muted-foreground" : "text-foreground"}>
                      {financiado ? "financiado por" : "garantia de"}{" "}
                      <span className="font-medium">{v.passivo.nome}</span>
                      {v.valorGarantidoCentavos != null && ` — ${formatarBRL(v.valorGarantidoCentavos)}`}
                    </span>
                    {garantiaLiberada && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
                        liberada (quitado)
                      </span>
                    )}
                    <form action={removerVinculo.bind(null, id, v.id)}>
                      <button type="submit" className="text-xs text-muted-foreground/70 hover:text-debt">
                        remover
                      </button>
                    </form>
                  </div>
                  {financiado && (
                    <p className="text-xs text-debt/80">
                      o saldo desse ativo veio do dinheiro dessa dívida — ainda não é patrimônio líquido novo
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form
          action={vincularAtivoPassivo.bind(null, id)}
          className="mt-3 flex flex-wrap items-end gap-3 glass-card rounded-2xl p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Passivo</label>
            <select name="passivoId" required className="w-56 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground">
              <option value="">selecione…</option>
              {passivos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo de vínculo</label>
            <select
              name="tipoVinculo"
              defaultValue="GARANTIA"
              className="w-56 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
            >
              <option value="GARANTIA">Garantia (esse ativo garante essa dívida)</option>
              <option value="FINANCIAMENTO">Financiamento (o saldo veio dessa dívida)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Valor em garantia (R$)</label>
            <input
              type="text"
              name="valorGarantido"
              placeholder="só p/ Garantia"
              className="w-40 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
            />
          </div>
          <Button type="submit">Vincular</Button>
        </form>
      </section>

      {ativo.historico.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground">Histórico de valor</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {ativo.historico.map((h) => (
              <li key={h.id} className="rounded glass-card p-3 text-sm">
                <div className="text-foreground">
                  {h.valorAnteriorCentavos != null ? formatarBRL(h.valorAnteriorCentavos) : "não documentado"} →{" "}
                  {formatarBRL(h.valorNovoCentavos)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground/70">
                  {new Date(h.registradoEm).toLocaleString("pt-BR")}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
