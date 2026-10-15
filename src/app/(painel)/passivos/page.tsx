import Link from "next/link";
import { TrendingDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import { EstruturaPassivo, type Passivo } from "@/generated/prisma";
import { calcularQualidadeDados } from "@/lib/qualidadeDados";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const ESTRUTURA_LABEL: Record<EstruturaPassivo, string> = {
  [EstruturaPassivo.AMORTIZA_NORMAL]: "Amortiza normalmente",
  [EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO]: "Só juros, sem amortização",
  [EstruturaPassivo.SEM_JUROS]: "Sem juros",
};

export default async function PassivosPage() {
  const [passivos, qualidadeDados] = await Promise.all([
    prisma.passivo.findMany({
      orderBy: [{ status: "asc" }, { valorQuitacaoCentavos: "desc" }],
    }),
    calcularQualidadeDados(),
  ]);

  const ativos = passivos.filter((p) => p.status === "ATIVO");
  const quitados = passivos.filter((p) => p.status === "QUITADO");
  const idsPendentes = new Set(qualidadeDados.passivosComReconciliacaoPendente.map((p) => p.id));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Cadastros"
        title="Passivos"
        description="Toda dívida que você tem — cartão, empréstimo, financiamento, até dívida informal. É daqui que sai o cálculo da sua rota de saída."
        action={
          <Button nativeButton={false} render={<Link href="/passivos/novo" />}>
            <TrendingDown className="size-4" /> Novo passivo
          </Button>
        }
      />
      <p className="-mt-6 text-xs text-muted-foreground">
        {ativos.length} ativo(s) · {quitados.length} quitado(s)
      </p>

      <TabelaPassivos
        passivos={ativos}
        idsPendentes={idsPendentes}
        mensagemVazia="Nenhuma dívida cadastrada ainda — comece pelo botão acima."
      />

      {quitados.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground">Quitados</h2>
          <div className="mt-3">
            <TabelaPassivos passivos={quitados} idsPendentes={idsPendentes} />
          </div>
        </section>
      )}
    </div>
  );
}

function TabelaPassivos({
  passivos,
  idsPendentes,
  mensagemVazia = "Nenhum passivo nesta lista.",
}: {
  passivos: Passivo[];
  idsPendentes: Set<string>;
  mensagemVazia?: string;
}) {
  if (passivos.length === 0) {
    return <p className="text-sm text-muted-foreground">{mensagemVazia}</p>;
  }

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-sm text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Credor</th>
            <th className="px-4 py-2 font-medium">Estrutura</th>
            <th className="px-4 py-2 font-medium text-right">Valor de quitação</th>
            <th className="px-4 py-2 font-medium text-right">Custo mensal</th>
            <th className="px-4 py-2 font-medium">Progresso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {passivos.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link href={`/passivos/${p.id}`} className="font-medium text-foreground hover:text-brand-text hover:underline">
                    {p.nome}
                  </Link>
                  {idsPendentes.has(p.id) && (
                    <span
                      title="Pagamento real pendente de confirmação"
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground before:size-1.5 before:rounded-full before:bg-debt before:content-['']"
                    >
                      pagamento pendente
                    </span>
                  )}
                </div>
                {p.observacao && (
                  <div className="mt-0.5 max-w-md text-xs text-muted-foreground">{p.observacao}</div>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{ESTRUTURA_LABEL[p.estrutura]}</td>
              <td className="num px-4 py-3 text-right text-debt">
                {p.valorQuitacaoCentavos != null ? (
                  formatarBRL(p.valorQuitacaoCentavos)
                ) : (
                  <span className="font-sans text-xs italic text-muted-foreground">não documentado</span>
                )}
              </td>
              <td className="num px-4 py-3 text-right text-foreground">
                {p.custoMensalCentavos != null ? (
                  formatarBRL(p.custoMensalCentavos)
                ) : p.custoMensalVariavel ? (
                  <span className="font-sans text-xs italic text-muted-foreground">variável por ciclo</span>
                ) : (
                  <span className="font-sans text-xs italic text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {p.parcelaAtual != null && p.totalParcelas != null
                  ? `${p.parcelaAtual}/${p.totalParcelas}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
