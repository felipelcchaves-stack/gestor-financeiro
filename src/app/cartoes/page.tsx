import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import { calcularHistoricoComTendenciaCartao, inicioDoPeriodo } from "@/lib/ofensores";
import { calcularParcelasAbertas } from "@/lib/parcelasFuturas";
import { PageHeader } from "@/components/PageHeader";
import { TendenciaMensalChart } from "@/app/ofensores/TendenciaMensalChart";

export const dynamic = "force-dynamic";

function nomeMes(mes: string) {
  const [ano, mesNum] = mes.split("-").map(Number);
  return new Date(ano, mesNum - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export default async function CartoesPage() {
  const cartoes = await prisma.passivo.findMany({
    where: { tipo: "cartao", status: "ATIVO" },
    orderBy: { nome: "asc" },
  });

  const inicioDoMes = inicioDoPeriodo("mes");

  const dados = await Promise.all(
    cartoes.map(async (cartao) => {
      const [serie, gastoMes, parcelasAbertas] = await Promise.all([
        calcularHistoricoComTendenciaCartao(cartao.id, cartao.nome),
        prisma.transacao.aggregate({
          where: { tipo: "DESPESA", ehTransferencia: false, passivoId: cartao.id, data: { gte: inicioDoMes } },
          _sum: { valorCentavos: true },
        }),
        calcularParcelasAbertas(cartao.id),
      ]);
      return { cartao, serie, gastoMesCentavos: gastoMes._sum.valorCentavos ?? 0, parcelasAbertas };
    })
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Ferramentas"
        title="Saúde dos cartões"
        description="Histórico de gasto por cartão, com uma estimativa dos próximos meses pelo seu ritmo recente — e o quanto você já gastou este mês perto da meta que definir."
      />

      {cartoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cartão ativo cadastrado.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {dados.map(({ cartao, serie, gastoMesCentavos, parcelasAbertas }) => {
            const meta = cartao.metaGastoMensalCentavos;
            const pct = meta != null && meta > 0 ? Math.round((gastoMesCentavos / meta) * 100) : null;

            return (
              <div key={cartao.id} className="glass-card rounded-2xl p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{cartao.nome}</span>
                  <span className="num text-sm text-debt">{formatarBRL(gastoMesCentavos)} este mês</span>
                </div>

                {meta != null ? (
                  <>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${(pct ?? 0) >= 100 ? "bg-debt" : "bg-gold"}`}
                        style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatarBRL(gastoMesCentavos)} de {formatarBRL(meta)} da meta ({pct}%)
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sem meta de gasto mensal definida —{" "}
                    <Link href="/limite-cartao" className="text-gold underline underline-offset-4">
                      definir uma
                    </Link>
                    .
                  </p>
                )}

                <div className="mt-4">
                  <TendenciaMensalChart series={[serie]} />
                </div>

                {parcelasAbertas.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Próximas parcelas
                      </h3>
                      <span className="num text-xs text-debt">
                        {formatarBRL(parcelasAbertas.reduce((acc, p) => acc + p.valorRestanteCentavos, 0))} ainda
                        comprometido
                      </span>
                    </div>
                    <ul className="mt-2 flex flex-col gap-2">
                      {parcelasAbertas.map((p) => (
                        <li key={p.transacaoId} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                          <span className="text-foreground">
                            {p.descricao}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({p.parcelaAtual}/{p.totalParcelas})
                            </span>
                          </span>
                          <span className="text-right text-xs text-muted-foreground">
                            {formatarBRL(p.valorCentavos)}/mês · faltam {p.parcelasRestantes} ·{" "}
                            {p.proximosMeses.map(nomeMes).join(", ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link href="/limite-cartao" className="text-xs text-gold underline underline-offset-4">
        Ver conta de redução de limite por gasto essencial
      </Link>
    </div>
  );
}
