import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { DocumentoSheet } from "./DocumentoSheet";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  extrato: "Extrato",
  fatura: "Fatura",
  imagem: "Imagem",
  contrato: "Contrato",
};

const TIPO_CLASSES: Record<string, string> = {
  extrato: "bg-liquidity/[0.06] text-liquidity",
  fatura: "bg-liquidity/[0.06] text-liquidity",
  imagem: "bg-gold/10 text-gold",
  contrato: "bg-muted text-muted-foreground",
};

export default async function DocumentosPage() {
  const documentos = await prisma.documento.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nomeArquivo: true,
      tipo: true,
      caminhoArquivo: true,
      createdAt: true,
      _count: {
        select: {
          transacoes: true,
          passivosFonte: true,
          historicosPassivo: true,
          ciclosFatura: true,
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Dados"
        title="Documentos"
        description={`${documentos.length} documento(s) importado(s) ou anexado(s)`}
      />

      {documentos.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4" /> Nenhum documento ainda. Use{" "}
          <a href="/importar" className="text-gold underline underline-offset-4">
            Importar
          </a>{" "}
          para começar.
        </p>
      ) : (
        <div className="overflow-x-auto glass-card rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Arquivo</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Importado em</th>
                <th className="px-4 py-2 font-medium">Vínculos</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documentos.map((d) => {
                const vinculos = [
                  d._count.transacoes > 0 ? `${d._count.transacoes} transação(ões)` : null,
                  d._count.passivosFonte > 0 ? `${d._count.passivosFonte} passivo(s)` : null,
                  d._count.historicosPassivo > 0 ? `${d._count.historicosPassivo} histórico(s)` : null,
                  d._count.ciclosFatura > 0 ? `${d._count.ciclosFatura} ciclo(s) de fatura` : null,
                ].filter((v): v is string => v !== null);

                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{d.nomeArquivo}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          TIPO_CLASSES[d.tipo] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {TIPO_LABEL[d.tipo] ?? d.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {vinculos.length > 0 ? vinculos.join(" · ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DocumentoSheet
                        documento={{
                          id: d.id,
                          nomeArquivo: d.nomeArquivo,
                          tipo: d.tipo,
                          tipoLabel: TIPO_LABEL[d.tipo] ?? d.tipo,
                          extensao: d.caminhoArquivo.slice(d.caminhoArquivo.lastIndexOf(".")),
                          createdAt: d.createdAt.toISOString(),
                          vinculos,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
