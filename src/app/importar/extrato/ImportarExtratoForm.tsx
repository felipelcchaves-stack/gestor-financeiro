"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  analisarExtrato,
  confirmarImportacaoExtrato,
  type ResultadoAnalise,
  type LancamentoParaConfirmar,
} from "./actions";
import { criarCategoriaAction } from "@/app/categorias/actions";
import { formatarBRL, reaisParaCentavos, centavosParaReais, parseNumeroBR } from "@/lib/money";
import { encontrarGruposSugeridos } from "@/lib/agrupamentoTransacoes";

type Opcao = { id: string; nome: string };
type CategoriaOpcao = { id: string; nome: string; parentId: string | null };

type VinculoTipo = "NENHUM" | "PASSIVO" | "ATIVO" | "META";

type LinhaRevisao = {
  key: string;
  data: string;
  descricao: string;
  valorCentavos: number;
  tipo: "DESPESA" | "ENTRADA";
  saldoAposCentavos: number | null;
  categoriaId: string;
  vinculoTipo: VinculoTipo;
  vinculoId: string;
  sugestaoOrigem: "exata" | "aproximada" | "valor" | null;
  essencial: boolean;
};

function contarSemCategoria(linhas: LinhaRevisao[]) {
  return linhas.filter((l) => !l.categoriaId).length;
}

function ordenarCategoriasHierarquicamente(categorias: CategoriaOpcao[]) {
  const raizes = categorias.filter((c) => c.parentId === null);
  const porPai = new Map<string, CategoriaOpcao[]>();
  for (const c of categorias) {
    if (c.parentId) {
      porPai.set(c.parentId, [...(porPai.get(c.parentId) ?? []), c]);
    }
  }

  const resultado: { id: string; label: string }[] = [];
  for (const raiz of raizes) {
    resultado.push({ id: raiz.id, label: raiz.nome });
    for (const filha of porPai.get(raiz.id) ?? []) {
      resultado.push({ id: filha.id, label: `— ${filha.nome}` });
    }
  }
  return resultado;
}

export function ImportarExtratoForm({
  contas,
  categorias,
  passivos,
  ativos,
  metas,
}: {
  contas: Opcao[];
  categorias: CategoriaOpcao[];
  passivos: Opcao[];
  ativos: Opcao[];
  metas: Opcao[];
}) {
  const router = useRouter();
  const [contaId, setContaId] = useState(contas[0]?.id ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [resultado, setResultado] = useState<ResultadoAnalise | null>(null);
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([]);
  const [categoriasState, setCategoriasState] = useState<CategoriaOpcao[]>(categorias);
  const [criandoCategoriaPara, setCriandoCategoriaPara] = useState<string | null>(null);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [novaCategoriaParentId, setNovaCategoriaParentId] = useState("");

  const [confirmando, setConfirmando] = useState(false);

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [categoriaEmLote, setCategoriaEmLote] = useState("");

  const opcoesCategoria = ordenarCategoriasHierarquicamente(categoriasState);

  // Agrupa as linhas do próprio lote entre si (descrição parecida ou valor
  // repetido) — antes mesmo de confirmar a importação, pra já entrar tudo
  // categorizado/vinculado junto, sem precisar arrumar retroativamente
  // depois em /transacoes.
  const gruposDoLote = useMemo(
    () =>
      encontrarGruposSugeridos(
        linhas.map((l) => ({
          id: l.key,
          descricao: l.descricao,
          valorCentavos: l.valorCentavos,
          tipo: l.tipo,
          categoriaId: l.categoriaId || null,
          passivoId: l.vinculoTipo === "PASSIVO" ? l.vinculoId : null,
          ativoId: l.vinculoTipo === "ATIVO" ? l.vinculoId : null,
          metaId: l.vinculoTipo === "META" ? l.vinculoId : null,
        }))
      ),
    [linhas]
  );
  const grupoPorKey = useMemo(() => {
    const mapa = new Map<string, (typeof gruposDoLote)[number]>();
    for (const g of gruposDoLote) for (const key of g.transacaoIds) mapa.set(key, g);
    return mapa;
  }, [gruposDoLote]);

  function aplicarGrupoComEssaLinha(key: string) {
    const linha = linhas.find((l) => l.key === key);
    const grupo = grupoPorKey.get(key);
    if (!linha || !grupo) return;
    const membros = new Set(grupo.transacaoIds);
    setLinhas((prev) =>
      prev.map((l) =>
        membros.has(l.key)
          ? {
              ...l,
              categoriaId: linha.categoriaId || l.categoriaId,
              vinculoTipo: linha.vinculoTipo !== "NENHUM" ? linha.vinculoTipo : l.vinculoTipo,
              vinculoId: linha.vinculoTipo !== "NENHUM" ? linha.vinculoId : l.vinculoId,
            }
          : l
      )
    );
  }

  async function handleAnalisar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!arquivo || !contaId) {
      setErro("Selecione a conta e o arquivo PDF.");
      return;
    }

    setAnalisando(true);
    try {
      const formData = new FormData();
      formData.set("arquivo", arquivo);
      formData.set("contaId", contaId);
      const res = await analisarExtrato(formData);
      setResultado(res);
      setSelecionadas(new Set());
      setLinhas(
        res.candidatos.map((c, i) => ({
          key: `${i}-${c.descricao}-${c.data}`,
          data: c.data,
          descricao: c.descricao,
          valorCentavos: c.valorCentavos,
          tipo: c.tipo,
          saldoAposCentavos: c.saldoAposCentavos,
          categoriaId: c.sugestao?.categoriaId ?? "",
          vinculoTipo: c.sugestao?.vinculoTipo ?? "NENHUM",
          vinculoId: c.sugestao?.vinculoId ?? "",
          sugestaoOrigem: c.sugestao?.origem ?? null,
          essencial: c.sugestao?.essencial ?? false,
        }))
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao analisar o extrato.");
    } finally {
      setAnalisando(false);
    }
  }

  function atualizarLinha(key: string, patch: Partial<LinhaRevisao>) {
    setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removerLinha(key: string) {
    setLinhas((prev) => prev.filter((l) => l.key !== key));
    setSelecionadas((prev) => {
      const novo = new Set(prev);
      novo.delete(key);
      return novo;
    });
  }

  function alternarSelecao(key: string) {
    setSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(key)) novo.delete(key);
      else novo.add(key);
      return novo;
    });
  }

  function alternarSelecionarTodos() {
    setSelecionadas((prev) => (prev.size === linhas.length ? new Set() : new Set(linhas.map((l) => l.key))));
  }

  function aplicarCategoriaEmLote() {
    if (!categoriaEmLote || selecionadas.size === 0) return;
    setLinhas((prev) => prev.map((l) => (selecionadas.has(l.key) ? { ...l, categoriaId: categoriaEmLote } : l)));
    setSelecionadas(new Set());
    setCategoriaEmLote("");
  }

  function iniciarNovaCategoria(key: string) {
    setCriandoCategoriaPara(key);
    setNovaCategoriaNome("");
    setNovaCategoriaParentId("");
  }

  async function confirmarNovaCategoria(key: string) {
    if (novaCategoriaNome.trim().length === 0) return;
    const nova = await criarCategoriaAction(novaCategoriaNome, novaCategoriaParentId || null);
    setCategoriasState((prev) => [...prev, { id: nova.id, nome: nova.nome, parentId: nova.parentId }]);
    atualizarLinha(key, { categoriaId: nova.id });
    setCriandoCategoriaPara(null);
  }

  async function handleConfirmar() {
    setErro(null);
    if (!resultado) return;

    const semCategoria = contarSemCategoria(linhas);
    if (semCategoria > 0) {
      const confirmado = window.confirm(
        `${semCategoria} lançamento(s) serão importados sem categoria — dá pra categorizar depois em Transações. Continuar?`
      );
      if (!confirmado) return;
    }

    setConfirmando(true);
    try {
      const lancamentos: LancamentoParaConfirmar[] = linhas.map((l) => ({
        data: l.data,
        descricao: l.descricao,
        valorCentavos: l.valorCentavos,
        tipo: l.tipo,
        saldoAposCentavos: l.saldoAposCentavos,
        categoriaId: l.categoriaId || null,
        vinculoTipo: l.vinculoTipo,
        vinculoId: l.vinculoTipo === "NENHUM" ? null : l.vinculoId || null,
        essencial: l.essencial,
      }));

      const res = await confirmarImportacaoExtrato({
        documentoId: resultado.documentoId,
        contaId,
        lancamentos,
        saldoDetectado: resultado.saldoDetectado,
      });
      router.push(`/transacoes?importados=${res.importados}&duplicados=${res.duplicadosNaConfirmacao}`);
      return;
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao confirmar a importação.");
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAnalisar} className="flex flex-wrap items-end gap-4 glass-card rounded-2xl p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Conta</label>
          <select
            value={contaId}
            onChange={(e) => setContaId(e.target.value)}
            className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          >
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Arquivo PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={analisando}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
        >
          {analisando ? "Analisando…" : "Analisar"}
        </button>
      </form>

      {erro && <p className="text-sm text-debt">{erro}</p>}

      {resultado && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{linhas.length} lançamento(s) novo(s) para revisar</span>
            {resultado.duplicadosIgnorados > 0 && (
              <span>{resultado.duplicadosIgnorados} já importado(s) anteriormente — ignorado(s)</span>
            )}
            {resultado.resumosDiariosIgnorados > 0 && (
              <span>{resultado.resumosDiariosIgnorados} linha(s) de saldo do dia (não são lançamento, só ajudam a achar seu saldo atual)</span>
            )}
            {contarSemCategoria(linhas) > 0 && (
              <span className="text-gold">{contarSemCategoria(linhas)} sem categoria</span>
            )}
          </div>

          {resultado.saldoDetectado && (
            <p className="text-xs text-muted-foreground">
              Saldo detectado no extrato em {new Date(resultado.saldoDetectado.data).toLocaleDateString("pt-BR")}:{" "}
              {formatarBRL(resultado.saldoDetectado.valorCentavos)} — atualiza o saldo da conta ao confirmar, se for mais recente que o que já está salvo.
            </p>
          )}

          {resultado.linhasNaoReconhecidas.length > 0 && (
            <details className="rounded-lg border border-gold/20 bg-gold/[0.06] p-3 text-sm text-gold">
              <summary className="cursor-pointer font-medium">
                {resultado.linhasNaoReconhecidas.length} linha(s) com data mas não reconhecida(s) —
                nada foi perdido, revise manualmente
              </summary>
              <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
                {resultado.linhasNaoReconhecidas.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          )}

          {linhas.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 glass-card rounded-2xl p-3">
              <span className="text-xs text-muted-foreground">
                {selecionadas.size > 0 ? `${selecionadas.size} selecionada(s)` : "selecione linhas pra categorizar em lote"}
              </span>
              <select
                value={categoriaEmLote}
                onChange={(e) => setCategoriaEmLote(e.target.value)}
                disabled={selecionadas.size === 0}
                className="rounded-lg border border-input bg-input/30 px-2 py-1 text-xs text-foreground disabled:opacity-50"
              >
                <option value="">categoria…</option>
                {opcoesCategoria.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={aplicarCategoriaEmLote}
                disabled={selecionadas.size === 0 || !categoriaEmLote}
                className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
              >
                Aplicar categoria
              </button>
            </div>
          )}

          {linhas.length > 0 && (
            <div className="overflow-x-auto glass-card rounded-2xl">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      <input
                        type="checkbox"
                        checked={linhas.length > 0 && selecionadas.size === linhas.length}
                        onChange={alternarSelecionarTodos}
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 font-medium text-right">Valor</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Categoria</th>
                    <th className="px-3 py-2 font-medium">Vínculo</th>
                    <th className="px-3 py-2 font-medium">Essencial</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {linhas.map((l) => (
                    <tr
                      key={l.key}
                      className={
                        l.sugestaoOrigem === "exata"
                          ? "bg-gold/[0.06]"
                          : l.sugestaoOrigem === "aproximada"
                            ? "bg-gold/[0.02]"
                            : l.sugestaoOrigem === "valor"
                              ? "bg-muted/40"
                              : undefined
                      }
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selecionadas.has(l.key)}
                          onChange={() => alternarSelecao(l.key)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={l.data}
                          onChange={(e) => atualizarLinha(l.key, { data: e.target.value })}
                          className="w-36 rounded border border-input px-1.5 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={l.descricao}
                          onChange={(e) => atualizarLinha(l.key, { descricao: e.target.value })}
                          className="w-64 rounded border border-input px-1.5 py-1 text-xs"
                        />
                        {l.sugestaoOrigem === "exata" && (
                          <div className="mt-0.5 text-[10px] text-gold">
                            sugerido por classificação anterior
                          </div>
                        )}
                        {l.sugestaoOrigem === "aproximada" && (
                          <div className="mt-0.5 text-[10px] text-gold/70">
                            sugestão aproximada (parecido com algo já classificado) — confira
                          </div>
                        )}
                        {l.sugestaoOrigem === "valor" && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            sugestão por valor — esse valor sempre foi classificado assim antes, confira com atenção
                          </div>
                        )}
                        {grupoPorKey.has(l.key) && (
                          <button
                            type="button"
                            onClick={() => aplicarGrupoComEssaLinha(l.key)}
                            className="mt-0.5 block text-[10px] text-liquidity hover:underline"
                            title="Aplica a categoria/vínculo dessa linha às outras linhas parecidas desse mesmo lote"
                          >
                            aplicar a {grupoPorKey.get(l.key)!.transacaoIds.length - 1} linha(s) parecida(s) do lote
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          key={l.key}
                          defaultValue={centavosParaReais(l.valorCentavos)}
                          onChange={(e) =>
                            atualizarLinha(l.key, {
                              valorCentavos: reaisParaCentavos(parseNumeroBR(e.target.value) ?? 0),
                            })
                          }
                          className="w-28 rounded border border-input px-1.5 py-1 text-right text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={l.tipo}
                          onChange={(e) =>
                            atualizarLinha(l.key, { tipo: e.target.value as "DESPESA" | "ENTRADA" })
                          }
                          className="rounded border border-input px-1.5 py-1 text-xs"
                        >
                          <option value="DESPESA">Despesa</option>
                          <option value="ENTRADA">Entrada</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {criandoCategoriaPara === l.key ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Nome da categoria"
                              value={novaCategoriaNome}
                              onChange={(e) => setNovaCategoriaNome(e.target.value)}
                              className="w-40 rounded border border-input px-1.5 py-1 text-xs"
                            />
                            <select
                              value={novaCategoriaParentId}
                              onChange={(e) => setNovaCategoriaParentId(e.target.value)}
                              className="w-40 rounded border border-input px-1.5 py-1 text-xs"
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
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => confirmarNovaCategoria(l.key)}
                                className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground"
                              >
                                Criar
                              </button>
                              <button
                                type="button"
                                onClick={() => setCriandoCategoriaPara(null)}
                                className="rounded border border-input px-2 py-0.5 text-xs"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <select
                            value={l.categoriaId}
                            onChange={(e) => {
                              if (e.target.value === "__nova__") {
                                iniciarNovaCategoria(l.key);
                              } else {
                                atualizarLinha(l.key, { categoriaId: e.target.value });
                              }
                            }}
                            className="w-44 rounded border border-input px-1.5 py-1 text-xs"
                          >
                            <option value="">selecione…</option>
                            {opcoesCategoria.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                            <option value="__nova__">+ Criar nova categoria…</option>
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={l.vinculoTipo === "NENHUM" ? "NENHUM" : `${l.vinculoTipo}:${l.vinculoId}`}
                          onChange={(e) => {
                            if (e.target.value === "NENHUM") {
                              atualizarLinha(l.key, { vinculoTipo: "NENHUM", vinculoId: "" });
                            } else {
                              const [tipo, id] = e.target.value.split(":");
                              atualizarLinha(l.key, { vinculoTipo: tipo as VinculoTipo, vinculoId: id });
                            }
                          }}
                          className="w-44 rounded border border-input px-1.5 py-1 text-xs"
                        >
                          <option value="NENHUM">nenhum</option>
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
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={l.essencial}
                          onChange={(e) => atualizarLinha(l.key, { essencial: e.target.checked })}
                          title="Marcar como despesa essencial recorrente (cria/atualiza uma Recorrência)"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removerLinha(l.key)}
                          className="text-xs text-muted-foreground/70 hover:text-debt"
                        >
                          remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {linhas.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={confirmando}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
              >
                {confirmando ? "Importando…" : `Confirmar importação (${linhas.length})`}
              </button>
              <span className="text-xs text-muted-foreground">
                Total: {formatarBRL(linhas.reduce((acc, l) => acc + l.valorCentavos, 0))}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
