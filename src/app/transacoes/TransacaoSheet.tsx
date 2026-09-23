"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatarBRL, centavosParaReais } from "@/lib/money";
import { ordenarCategoriasHierarquicamente, type CategoriaOpcao } from "@/lib/categorias";
import { atualizarTransacao, excluirTransacao } from "./actions";

type TransacaoDetalhe = {
  id: string;
  data: string;
  descricao: string;
  valorCentavos: number;
  tipo: string;
  categoriaId: string | null;
  origem: string;
  origemLabel: string;
  conta: string | null;
  categoria: string | null;
  vinculo: string | null;
  ehTransferencia: boolean;
  contaDestinoId: string | null;
  documento: { id: string; nomeArquivo: string; tipoLabel: string; extensao: string } | null;
};

const EXTENSOES_IMAGEM = [".png", ".jpg", ".jpeg", ".webp"];

export function TransacaoSheet({
  transacao,
  categorias,
  contas,
}: {
  transacao: TransacaoDetalhe;
  categorias: CategoriaOpcao[];
  contas: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const isDespesa = transacao.tipo === "DESPESA";
  const opcoesCategoria = ordenarCategoriasHierarquicamente(categorias);

  async function handleSalvar(formData: FormData) {
    setErro(null);
    setSalvando(true);
    try {
      await atualizarTransacao(transacao.id, formData);
      router.refresh();
      setEditando(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar a transação.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir() {
    if (!window.confirm(`Excluir a transação "${transacao.descricao}"? Essa ação não pode ser desfeita.`)) return;
    setErro(null);
    setExcluindo(true);
    try {
      await excluirTransacao(transacao.id);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao excluir a transação.");
      setExcluindo(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(novoOpen) => {
        setOpen(novoOpen);
        if (!novoOpen) setEditando(false);
      }}
    >
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <Eye className="size-3.5" /> ver
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{transacao.descricao}</SheetTitle>
          <SheetDescription>
            {new Date(transacao.data).toLocaleDateString("pt-BR")} · {transacao.origemLabel}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          {erro && <p className="text-sm text-debt">{erro}</p>}

          {editando ? (
            <form action={handleSalvar} className="flex flex-col gap-3">
              <Campo label="Descrição">
                <input
                  name="descricao"
                  defaultValue={transacao.descricao}
                  required
                  className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Data">
                  <input
                    name="data"
                    type="date"
                    defaultValue={transacao.data.slice(0, 10)}
                    required
                    className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                  />
                </Campo>
                <Campo label="Tipo">
                  <select
                    name="tipo"
                    defaultValue={transacao.tipo}
                    className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="DESPESA">Despesa</option>
                    <option value="ENTRADA">Entrada</option>
                  </select>
                </Campo>
                <Campo label="Valor (R$)">
                  <input
                    name="valor"
                    type="text"
                    inputMode="decimal"
                    defaultValue={centavosParaReais(transacao.valorCentavos)}
                    required
                    className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                  />
                </Campo>
                <Campo label="Categoria">
                  <select
                    name="categoriaId"
                    defaultValue={transacao.categoriaId ?? ""}
                    className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="">nenhuma</option>
                    {opcoesCategoria.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="ehTransferencia" defaultChecked={transacao.ehTransferencia} />
                Transferência entre minhas contas (TED/DOC/PIX pra pagar dívida, aporte em investimento etc. — não
                é gasto nem receita de verdade)
              </label>
              <Campo label="Conta destino (se for transferência)">
                <select
                  name="contaDestinoId"
                  defaultValue={transacao.contaDestinoId ?? ""}
                  className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="">nenhuma</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="flex gap-2">
                <Button type="submit" disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className={`num text-2xl font-semibold ${
                      transacao.ehTransferencia ? "text-muted-foreground" : isDespesa ? "text-debt" : "text-liquidity"
                    }`}
                  >
                    {isDespesa ? "-" : "+"}
                    {formatarBRL(transacao.valorCentavos)}
                  </p>
                  {transacao.ehTransferencia && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      transferência entre contas — não conta como gasto ou receita
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
                  <Pencil className="size-3.5" /> editar
                </Button>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Campo label="Conta" value={transacao.conta ?? "—"} />
                <Campo label="Categoria" value={transacao.categoria ?? "—"} />
                <Campo label="Vínculo" value={transacao.vinculo ?? "—"} />
                <Campo label="Origem" value={transacao.origemLabel} />
              </dl>

              {transacao.documento && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Documento de origem
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {transacao.documento.nomeArquivo} · {transacao.documento.tipoLabel}
                  </p>
                  {EXTENSOES_IMAGEM.includes(transacao.documento.extensao.toLowerCase()) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/documentos/${transacao.documento.id}`}
                      alt={transacao.documento.nomeArquivo}
                      className="mt-2 w-full rounded-lg border border-border"
                    />
                  ) : (
                    <iframe
                      src={`/api/documentos/${transacao.documento.id}`}
                      className="mt-2 h-[50vh] w-full rounded-lg border border-border"
                      title={transacao.documento.nomeArquivo}
                    />
                  )}
                  <a
                    href={`/api/documentos/${transacao.documento.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-gold underline underline-offset-4"
                  >
                    abrir em nova aba
                  </a>
                </div>
              )}

              <Button variant="destructive" size="sm" className="w-fit" onClick={handleExcluir} disabled={excluindo}>
                {excluindo ? "Excluindo…" : "Excluir transação"}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Campo({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      {children ?? <dd className="mt-0.5 text-sm text-foreground">{value}</dd>}
    </div>
  );
}
