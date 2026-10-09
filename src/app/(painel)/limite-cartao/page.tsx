import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatarBRL, centavosParaReais } from "@/lib/money";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { definirLimiteCartao, definirMetaGastoMensal } from "./actions";

export const dynamic = "force-dynamic";

export default async function LimiteCartaoPage() {
  const cartoes = await prisma.passivo.findMany({
    where: { tipo: "cartao", status: "ATIVO" },
    include: {
      recorrencias: { where: { ativa: true, essencial: true, tipo: "DESPESA" } },
    },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Ferramentas"
        title="Limite de cartão"
        description="Compara o gasto essencial identificado em cada cartão com o limite atualmente liberado — pra saber quanto dá pra pedir de redução sem arriscar bloquear um débito que não pode parar."
      />

      {cartoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cartão ativo cadastrado.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {cartoes.map((cartao) => {
            const essencialCentavos = cartao.recorrencias.reduce((acc, r) => acc + r.valorCentavos, 0);
            const limite = cartao.limiteCartaoCentavos;
            const diferenca = limite != null ? limite - essencialCentavos : null;

            return (
              <div key={cartao.id} className="glass-card rounded-2xl p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{cartao.nome}</span>
                  <span className="num text-sm text-gold">{formatarBRL(essencialCentavos)}/mês essencial</span>
                </div>

                {cartao.recorrencias.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhuma recorrência essencial vinculada a esse cartão ainda. Marque despesas fixas em{" "}
                    <span className="text-gold">Recorrências</span> ou na revisão da importação de extrato.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                    {cartao.recorrencias.map((r) => (
                      <li key={r.id} className="flex justify-between">
                        <span>{r.nome}</span>
                        <span className="num">{formatarBRL(r.valorCentavos)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <form action={definirLimiteCartao.bind(null, cartao.id)} className="mt-4 flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Limite atual liberado (R$)</label>
                  <input
                    name="limite"
                    type="text"
                    inputMode="decimal"
                    defaultValue={limite != null ? centavosParaReais(limite) : undefined}
                    placeholder="ex: 5000"
                    className="w-32 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                  />
                  <Button type="submit" size="sm">
                    Salvar
                  </Button>
                </form>

                <form action={definirMetaGastoMensal.bind(null, cartao.id)} className="mt-2 flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Meta de gasto mensal (R$)</label>
                  <input
                    name="meta"
                    type="text"
                    inputMode="decimal"
                    defaultValue={
                      cartao.metaGastoMensalCentavos != null ? centavosParaReais(cartao.metaGastoMensalCentavos) : undefined
                    }
                    placeholder="ex: 3000"
                    className="w-32 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Salvar
                  </Button>
                  <Link href="/cartoes" className="text-xs text-gold underline underline-offset-4">
                    ver histórico e progresso
                  </Link>
                </form>

                {diferenca != null && (
                  <p
                    className={`mt-2 text-sm ${diferenca >= 0 ? "text-liquidity" : "text-debt"}`}
                  >
                    {diferenca >= 0
                      ? `Você pode pedir pra reduzir até ${formatarBRL(diferenca)} sem afetar nenhum gasto essencial identificado.`
                      : `Seu limite atual (${formatarBRL(limite!)}) já está abaixo do gasto essencial identificado — reduzir mais arrisca bloquear um débito que não pode parar.`}
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
