"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatarBRL } from "@/lib/money";
import { ordenarCategoriasHierarquicamente, type CategoriaOpcao } from "@/lib/categorias";
import { TransacaoSheet } from "./TransacaoSheet";
import { atualizarCategoriaEmLote, atualizarVinculoEmLote, marcarTransferenciaEmLote, type VinculoTipoLote } from "./actions";
import { criarCategoriaAction } from "@/app/categorias/actions";

type Opcao = { id: string; nome: string };

export type TransacaoLinha = {
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
  ehDesembolsoDeEmprestimo: boolean;
  ehTransferencia: boolean;
  contaDestinoId: string | null;
  semelhancaPct: number | null;
  documento: { id: string; nomeArquivo: string; tipoLabel: string; extensao: string } | null;
};

export function TransacoesTable({
  transacoes,
  categorias,
  passivos,
  ativos,
  metas,
  contas,
}: {
  transacoes: TransacaoLinha[];
  categorias: CategoriaOpcao[];
  passivos: Opcao[];
  ativos: Opcao[];
  metas: Opcao[];
  contas: Opcao[];
}) {
  const router = useRouter();
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [categoriaEmLote, setCategoriaEmLote] = useState("");
  const [vinculoEmLote, setVinculoEmLote] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [aplicandoVinculo, setAplicandoVinculo] = useState(false);
  const [aplicandoTransferencia, setAplicandoTransferencia] = useState(false);
  const [ordenacao, setOrdenacao] = useState<{ campo: "data" | "valorCentavos"; direcao: "asc" | "desc" } | null>(
    null
  );

  const [categoriasState, setCategoriasState] = useState<CategoriaOpcao[]>(categorias);
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [novaCategoriaParentId, setNovaCategoriaParentId] = useState("");

  const opcoesCategoria = ordenarCategoriasHierarquicamente(categoriasState);

  async function confirmarNovaCategoria() {
    if (novaCategoriaNome.trim().length === 0) return;
    const nova = await criarCategoriaAction(novaCategoriaNome, novaCategoriaParentId || null);
    setCategoriasState((prev) => [...prev, { id: nova.id, nome: nova.nome, parentId: nova.parentId }]);
    setCategoriaEmLote(nova.id);
    setCriandoCategoria(false);
  }

  const transacoesExibidas = useMemo(() => {
    if (!ordenacao) return transacoes;
    const { campo, direcao } = ordenacao;
    const sinal = direcao === "asc" ? 1 : -1;
    return [...transacoes].sort((a, b) => {
      if (campo === "data") return (new Date(a.data).getTime() - new Date(b.data).getTime()) * sinal;
      return (a.valorCentavos - b.valorCentavos) * sinal;
    });
  }, [transacoes, ordenacao]);

  function alternarOrdenacao(campo: "data" | "valorCentavos") {
    setOrdenacao((prev) => {
      if (!prev || prev.campo !== campo) return { campo, direcao: "desc" };
      return { campo, direcao: prev.direcao === "desc" ? "asc" : "desc" };
    });
  }

  function alternarSelecao(id: string) {
    setSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarSelecionarTodos() {
    setSelecionadas((prev) => (prev.size === transacoes.length ? new Set() : new Set(transacoes.map((t) => t.id))));
  }

  async function aplicarCategoriaEmLote() {
    if (!categoriaEmLote || selecionadas.size === 0) return;
    setAplicando(true);
    try {
      await atualizarCategoriaEmLote(Array.from(selecionadas), categoriaEmLote);
      setSelecionadas(new Set());
      setCategoriaEmLote("");
      router.refresh();
    } finally {
      setAplicando(false);
    }
  }

  async function aplicarVinculoEmLote() {
    if (!vinculoEmLote || selecionadas.size === 0) return;
    const [tipo, id] = vinculoEmLote.split(":");
    setAplicandoVinculo(true);
    try {
      await atualizarVinculoEmLote(Array.from(selecionadas), tipo as VinculoTipoLote, id);
      setSelecionadas(new Set());
      setVinculoEmLote("");
      router.refresh();
    } finally {
      setAplicandoVinculo(false);
    }
  }

  async function marcarTransferencia(valor: boolean) {
    if (selecionadas.size === 0) return;
    setAplicandoTransferencia(true);
    try {
      await marcarTransferenciaEmLote(Array.from(selecionadas), valor);
      setSelecionadas(new Set());
      router.refresh();
    } finally {
      setAplicandoTransferencia(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 glass-card rounded-2xl p-3">
        <span className="text-xs text-muted-foreground">
          {selecionadas.size > 0 ? `${selecionadas.size} selecionada(s)` : "selecione linhas pra categorizar em lote"}
        </span>
        {criandoCategoria ? (
          <>
            <input
              type="text"
              autoFocus
              placeholder="Nome da nova categoria"
              value={novaCategoriaNome}
              onChange={(e) => setNovaCategoriaNome(e.target.value)}
              className="w-44 rounded-lg border border-input bg-input/30 px-2 py-1 text-xs text-foreground"
            />
            <select
              value={novaCategoriaParentId}
              onChange={(e) => setNovaCategoriaParentId(e.target.value)}
              className="w-44 rounded-lg border border-input bg-input/30 px-2 py-1 text-xs text-foreground"
            >
              <option value="">(categoria raiz)</option>
              {opcoesCategoria
                .filter((o) => !o.label.startsWith("— "))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    dentro de {o.label}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={confirmarNovaCategoria}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/80"
            >
              Criar
            </button>
            <button
              type="button"
              onClick={() => setCriandoCategoria(false)}
              className="rounded-lg border border-input px-3 py-1 text-xs text-muted-foreground"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <select
              value={categoriaEmLote}
              onChange={(e) => {
                if (e.target.value === "__nova__") {
                  setCriandoCategoria(true);
                  setNovaCategoriaNome("");
                  setNovaCategoriaParentId("");
                } else {
                  setCategoriaEmLote(e.target.value);
                }
              }}
              disabled={selecionadas.size === 0}
              className="rounded-lg border border-input bg-input/30 px-2 py-1 text-xs text-foreground disabled:opacity-50"
            >
              <option value="">categoria…</option>
              {opcoesCategoria.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
              <option value="__nova__">+ Criar nova subcategoria…</option>
            </select>
            <button
              type="button"
              onClick={aplicarCategoriaEmLote}
              disabled={selecionadas.size === 0 || !categoriaEmLote || aplicando}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
            >
              {aplicando ? "Aplicando…" : "Aplicar categoria"}
            </button>
          </>
        )}

        <span className="h-4 w-px bg-border" />

        <select
          value={vinculoEmLote}
          onChange={(e) => setVinculoEmLote(e.target.value)}
          disabled={selecionadas.size === 0}
          className="rounded-lg border border-input bg-input/30 px-2 py-1 text-xs text-foreground disabled:opacity-50"
        >
          <option value="">vínculo…</option>
          {passivos.length > 0 && (
            <optgroup label="Passivos">
              {passivos.map((p) => (
                <option key={p.id} value={`PASSIVO:${p.id}`}>
                  {p.nome}
                </option>
              ))}
            </optgroup>
          )}
          {ativos.length > 0 && (
            <optgroup label="Ativos">
              {ativos.map((a) => (
                <option key={a.id} value={`ATIVO:${a.id}`}>
                  {a.nome}
                </option>
              ))}
            </optgroup>
          )}
          {metas.length > 0 && (
            <optgroup label="Metas">
              {metas.map((m) => (
                <option key={m.id} value={`META:${m.id}`}>
                  {m.nome}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          onClick={aplicarVinculoEmLote}
          disabled={selecionadas.size === 0 || !vinculoEmLote || aplicandoVinculo}
          className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
          title="Vincula as transações selecionadas a esse passivo/ativo/meta — é o que faz o saldo do passivo poder ser reconciliado com os pagamentos reais."
        >
          {aplicandoVinculo ? "Aplicando…" : "Aplicar vínculo"}
        </button>

        <span className="h-4 w-px bg-border" />

        <button
          type="button"
          onClick={() => marcarTransferencia(true)}
          disabled={selecionadas.size === 0 || aplicandoTransferencia}
          className="rounded-lg border border-input px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Dinheiro que só mudou de conta (TED/DOC/PIX entre bancos próprios, aporte em investimento) — não é gasto nem receita, some dos relatórios de ofensor."
        >
          {aplicandoTransferencia ? "Aplicando…" : "Marcar transferência"}
        </button>
        <button
          type="button"
          onClick={() => marcarTransferencia(false)}
          disabled={selecionadas.size === 0 || aplicandoTransferencia}
          className="rounded-lg border border-input px-3 py-1 text-xs text-muted-foreground/70 hover:text-foreground disabled:opacity-50"
        >
          Desmarcar
        </button>
      </div>

      <div className="overflow-x-auto glass-card rounded-2xl">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">
                <input
                  type="checkbox"
                  checked={transacoes.length > 0 && selecionadas.size === transacoes.length}
                  onChange={alternarSelecionarTodos}
                />
              </th>
              <th
                className="cursor-pointer px-3 py-2 font-medium select-none hover:text-foreground"
                onClick={() => alternarOrdenacao("data")}
              >
                Data{" "}
                {ordenacao?.campo === "data" &&
                  (ordenacao.direcao === "desc" ? (
                    <ArrowDown className="inline size-3" />
                  ) : (
                    <ArrowUp className="inline size-3" />
                  ))}
              </th>
              <th className="px-3 py-2 font-medium">Descrição</th>
              <th className="px-3 py-2 font-medium">Categoria</th>
              <th className="px-3 py-2 font-medium">Vínculo</th>
              <th className="px-3 py-2 font-medium">Origem</th>
              <th
                className="cursor-pointer px-3 py-2 text-right font-medium select-none hover:text-foreground"
                onClick={() => alternarOrdenacao("valorCentavos")}
              >
                Valor{" "}
                {ordenacao?.campo === "valorCentavos" &&
                  (ordenacao.direcao === "desc" ? (
                    <ArrowDown className="inline size-3" />
                  ) : (
                    <ArrowUp className="inline size-3" />
                  ))}
              </th>
              <th className="px-3 py-2 font-medium"></th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transacoesExibidas.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selecionadas.has(t.id)} onChange={() => alternarSelecao(t.id)} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(t.data).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {t.descricao}
                  {t.semelhancaPct != null && (
                    <span className="ml-1.5 rounded bg-gold/10 px-1 py-0.5 text-[10px] text-gold">
                      parecido {t.semelhancaPct}%
                    </span>
                  )}
                  <Link
                    href={`/transacoes?tipo=${t.tipo}&q=${encodeURIComponent(t.descricao)}&parecido=1`}
                    className="ml-1.5 text-[10px] text-muted-foreground/60 hover:text-gold hover:underline"
                    title="Achar outras transações com descrição parecida com essa"
                  >
                    achar parecidos
                  </Link>
                </td>
                <td className={`px-3 py-2 ${t.categoria ? "text-muted-foreground" : "text-gold"}`}>
                  {t.categoria ?? "sem categoria"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {t.vinculo ?? "—"}
                  {t.ehDesembolsoDeEmprestimo && (
                    <span className="ml-1.5 text-[10px] text-debt">empréstimo recebido</span>
                  )}
                  {t.ehTransferencia && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">transferência</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground/70">{t.origem}</td>
                <td
                  className={`num px-3 py-2 text-right ${
                    t.ehTransferencia
                      ? "text-muted-foreground"
                      : t.tipo === "DESPESA" || t.ehDesembolsoDeEmprestimo
                        ? "text-debt"
                        : "text-liquidity"
                  }`}
                >
                  {t.tipo === "DESPESA" ? "-" : "+"}
                  {formatarBRL(t.valorCentavos)}
                </td>
                <td className="px-3 py-2">
                  {t.documento && (
                    <a
                      href={`/api/documentos/${t.documento.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground/70 hover:text-foreground hover:underline"
                    >
                      ver documento
                    </a>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <TransacaoSheet transacao={t} categorias={categoriasState} contas={contas} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
