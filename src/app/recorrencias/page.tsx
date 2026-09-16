import Link from "next/link";
import { Repeat } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ConfirmForm";
import { alternarAtivaRecorrencia, excluirRecorrencia } from "./actions";

export const dynamic = "force-dynamic";

const FREQUENCIA_LABEL: Record<string, string> = {
  MENSAL: "Mensal",
  SEMANAL: "Semanal",
  ANUAL: "Anual",
  UNICA: "Única",
};

export default async function RecorrenciasPage() {
  const recorrencias = await prisma.recorrenciaFinanceira.findMany({
    include: { categoria: true, passivo: true },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Recorrências"
        description="Entradas e despesas que se repetem todo mês — salário, aluguel, assinaturas. Alimentam a Margem Livre do Mapa."
        action={
          <Button nativeButton={false} render={<Link href="/recorrencias/novo" />}>
            <Repeat className="size-4" /> Nova recorrência
          </Button>
        }
      />

      {recorrencias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma recorrência cadastrada ainda.</p>
      ) : (
        <div className="overflow-x-auto glass-card rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Categoria</th>
                <th className="px-4 py-2 font-medium">Cartão</th>
                <th className="px-4 py-2 font-medium">Frequência</th>
                <th className="px-4 py-2 font-medium">Confiabilidade</th>
                <th className="px-4 py-2 font-medium text-right">Valor</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recorrencias.map((r) => (
                <tr key={r.id} className={r.ativa ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {r.nome}
                    {r.essencial && (
                      <span className="ml-2 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                        essencial
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.categoria?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.passivo?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{FREQUENCIA_LABEL[r.frequencia]}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.confiabilidade === "CONFIRMADO" ? "Confirmado" : "Estimado"}
                  </td>
                  <td
                    className={`num px-4 py-3 text-right ${
                      r.tipo === "DESPESA" ? "text-debt" : "text-liquidity"
                    }`}
                  >
                    {r.tipo === "DESPESA" ? "-" : "+"}
                    {formatarBRL(r.valorCentavos)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.ativa ? "bg-liquidity/[0.06] text-liquidity" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.ativa ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3 text-xs">
                      <Link href={`/recorrencias/${r.id}/editar`} className="text-muted-foreground/70 hover:text-foreground">
                        editar
                      </Link>
                      <form action={alternarAtivaRecorrencia.bind(null, r.id)}>
                        <button type="submit" className="text-muted-foreground/70 hover:text-gold">
                          {r.ativa ? "desativar" : "reativar"}
                        </button>
                      </form>
                      <ConfirmForm
                        action={excluirRecorrencia.bind(null, r.id)}
                        confirmMessage={`Excluir a recorrência "${r.nome}"? Essa ação não pode ser desfeita.`}
                      >
                        <button type="submit" className="text-muted-foreground/70 hover:text-debt">
                          excluir
                        </button>
                      </ConfirmForm>
                    </div>
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
