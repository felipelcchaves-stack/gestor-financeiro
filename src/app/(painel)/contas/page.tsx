import Link from "next/link";
import { Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarBRL, centavosParaReais } from "@/lib/money";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ConfirmForm";
import { atualizarSaldoConta, excluirConta } from "./actions";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  CORRENTE_PF: "Corrente PF",
  CORRENTE_PJ: "Corrente PJ",
  CHEQUE_ESPECIAL: "Cheque especial",
  POUPANCA: "Poupança",
  CARTAO_CREDITO: "Cartão de crédito",
};

export default async function ContasPage() {
  const contas = await prisma.conta.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Contas"
        description={`${contas.length} conta(s) cadastrada(s)`}
        action={
          <Button nativeButton={false} render={<Link href="/contas/novo" />}>
            <Wallet className="size-4" /> Nova conta
          </Button>
        }
      />

      <div className="overflow-hidden glass-card rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium text-right">Saldo atual</th>
              <th className="px-4 py-2 font-medium">Atualizado em</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contas.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">{TIPO_LABEL[c.tipo]}</td>
                <td className="px-4 py-3 text-right">
                  <form
                    action={atualizarSaldoConta.bind(null, c.id)}
                    className="flex items-center justify-end gap-1.5"
                  >
                    <input
                      name="saldo"
                      type="text"
                      inputMode="decimal"
                      defaultValue={c.saldoAtualCentavos != null ? centavosParaReais(c.saldoAtualCentavos) : ""}
                      placeholder="0,00"
                      className="num w-28 rounded-lg border border-input bg-input/30 px-2 py-1 text-right text-sm text-foreground"
                    />
                    <button type="submit" className="text-xs text-gold underline underline-offset-4">
                      salvar
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.saldoAtualizadoEm ? new Date(c.saldoAtualizadoEm).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <ConfirmForm
                    action={excluirConta.bind(null, c.id)}
                    confirmMessage={`Excluir a conta "${c.nome}"? Essa ação não pode ser desfeita.`}
                  >
                    <button type="submit" className="text-xs text-muted-foreground/70 hover:text-debt">
                      excluir
                    </button>
                  </ConfirmForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
