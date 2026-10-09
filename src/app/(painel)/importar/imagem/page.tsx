import { prisma } from "@/lib/prisma";
import { ImportarImagemForm } from "./ImportarImagemForm";

export const dynamic = "force-dynamic";

export default async function ImportarImagemPage() {
  const [contas, categorias, passivos, ativos, metas] = await Promise.all([
    prisma.conta.findMany({ orderBy: { nome: "asc" } }),
    prisma.categoria.findMany({ orderBy: { nome: "asc" } }),
    prisma.passivo.findMany({ where: { status: "ATIVO" }, orderBy: { nome: "asc" } }),
    prisma.ativo.findMany({ orderBy: { nome: "asc" } }),
    prisma.meta.findMany({ where: { status: "ATIVA" }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Importar print / imagem</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Anexe o print do app do banco e digite você mesmo o que está vendo na tela. Sem leitura
          automática de imagem aqui de propósito — o histórico de erro de transcrição desta
          auditoria já mostrou que confirmação manual é mais confiável do que adivinhar.
        </p>
      </div>

      <ImportarImagemForm
        contas={contas.map((c) => ({ id: c.id, nome: c.nome }))}
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, parentId: c.parentId }))}
        passivos={passivos.map((p) => ({ id: p.id, nome: p.nome }))}
        ativos={ativos.map((a) => ({ id: a.id, nome: a.nome }))}
        metas={metas.map((m) => ({ id: m.id, nome: m.nome }))}
      />
    </div>
  );
}
