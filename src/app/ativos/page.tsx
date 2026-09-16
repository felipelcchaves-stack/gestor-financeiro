import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AtivosPage() {
  const ativos = await prisma.ativo.findMany({
    include: { vinculos: { include: { passivo: true } } },
    orderBy: { valorCentavos: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Ativos"
        description="Bens que valem dinheiro e que você poderia usar — CDB, investimento, reserva. Ajuda a calcular seu patrimônio real."
        action={
          <Button nativeButton={false} render={<Link href="/ativos/novo" />}>
            <PiggyBank className="size-4" /> Novo ativo
          </Button>
        }
      />
      <p className="-mt-4 text-xs text-muted-foreground">{ativos.length} ativo(s) cadastrado(s)</p>

      {ativos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum ativo cadastrado ainda — comece pelo botão acima.</p>
      ) : (
      <div className="overflow-hidden glass-card rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium text-right">Valor</th>
              <th className="px-4 py-2 font-medium">Liquidez</th>
              <th className="px-4 py-2 font-medium">Vinculação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ativos.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <Link href={`/ativos/${a.id}`} className="font-medium text-foreground hover:underline">
                    {a.nome}
                  </Link>
                  {a.observacao && (
                    <div className="mt-0.5 max-w-md text-xs text-muted-foreground/70">{a.observacao}</div>
                  )}
                </td>
                <td className="num px-4 py-3 text-right text-liquidity">
                  {formatarBRL(a.valorCentavos)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{a.liquidez}</td>
                <td className="px-4 py-3">
                  {a.vinculos.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="flex flex-col gap-0.5">
                      {a.vinculos.map((v) => (
                        <span key={v.id} className={v.tipoVinculo === "FINANCIAMENTO" ? "text-debt" : "text-muted-foreground"}>
                          {v.tipoVinculo === "FINANCIAMENTO" ? "financiado por" : "garantia de"} {v.passivo.nome}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
