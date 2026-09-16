"use client";

import { useMemo, useState } from "react";
import { analisarFatura, confirmarImportacaoFatura, type ResultadoAnaliseFatura } from "./actions";
import { registrarCicloFatura } from "@/app/passivos/actions";
import { centavosParaReais, reaisParaCentavos, formatarBRL, parseNumeroBR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { encontrarGruposSugeridos } from "@/lib/agrupamentoTransacoes";

type CategoriaOpcao = { id: string; nome: string; parentId: string | null };

type LinhaRevisao = {
  key: string;
  documentoId: string;
  data: string;
  descricao: string;
  valorCentavos: number;
  tipo: "DESPESA" | "ENTRADA";
  categoriaId: string;
  essencial: boolean;
  sugestaoOrigem: "exata" | "aproximada" | "valor" | null;
  // Texto livre "atual/total" (ex: "2/10") — vazio quando não é parcelado.
  // Só convertido pra número na hora de confirmar.
  parcela: string;
};

// Converte o texto livre "2/10" em { atual, total } — null quando o campo
// está vazio ou não bate o formato (tratado como "não é parcelado").
function parseParcela(texto: string): { atual: number; total: number } | null {
  const match = texto.trim().match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (!match) return null;
  const atual = Number(match[1]);
  const total = Number(match[2]);
  if (total < 2 || atual < 1 || atual > total) return null;
  return { atual, total };
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

export function ImportarFaturaForm({
  cartoes,
  categorias,
}: {
  cartoes: { id: string; nome: string }[];
  categorias: CategoriaOpcao[];
}) {
  const [passivoId, setPassivoId] = useState(cartoes[0]?.id ?? "");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoAnaliseFatura[]>([]);
  // Nome do arquivo original de cada fatura, por documentoId — só pra
  // rotular a coluna "Fatura" na tabela de compras (o parser não extrai
  // uma referência de mês automaticamente).
  const [nomeArquivoPorDocumento, setNomeArquivoPorDocumento] = useState<Record<string, string>>({});
  const [salvandoDocumento, setSalvandoDocumento] = useState<string | null>(null);
  const [sucessoDocumento, setSucessoDocumento] = useState<Record<string, boolean>>({});

  const [linhas, setLinhas] = useState<LinhaRevisao[]>([]);
  const [importandoLinhas, setImportandoLinhas] = useState(false);
  const [resultadoLinhas, setResultadoLinhas] = useState<{ importados: number; duplicadosNaConfirmacao: number } | null>(
    null
  );

  const opcoesCategoria = ordenarCategoriasHierarquicamente(categorias);
  const totalDuplicadosIgnorados = resultados.reduce((acc, r) => acc + r.duplicadosIgnorados, 0);

  // Agrupa as compras do próprio lote entre si (descrição parecida ou valor
  // repetido) — não tem vínculo por linha aqui (todas já são desse cartão),
  // então o grupo só propaga categoria/essencial.
  const gruposDoLote = useMemo(
    () =>
      encontrarGruposSugeridos(
        linhas.map((l) => ({
          id: l.key,
          descricao: l.descricao,
          valorCentavos: l.valorCentavos,
          tipo: l.tipo,
          categoriaId: l.categoriaId || null,
          passivoId: null,
          ativoId: null,
          metaId: null,
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
          ? { ...l, categoriaId: linha.categoriaId || l.categoriaId, essencial: linha.essencial || l.essencial }
          : l
      )
    );
  }

  async function handleAnalisar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (arquivos.length === 0 || !passivoId) {
      setErro("Selecione o cartão e ao menos um arquivo PDF.");
      return;
    }

    setAnalisando(true);
    try {
      // Sequencial, não em paralelo — cada análise já faz parsing de PDF +
      // escrita em disco/banco; disparar tudo de uma vez só complicaria sem
      // ganhar velocidade real num fluxo de revisão manual de qualquer jeito.
      const novosResultados: ResultadoAnaliseFatura[] = [];
      const novosNomes: Record<string, string> = {};
      for (const arquivo of arquivos) {
        const formData = new FormData();
        formData.set("arquivo", arquivo);
        formData.set("passivoId", passivoId);
        const res = await analisarFatura(formData);
        novosResultados.push(res);
        novosNomes[res.documentoId] = arquivo.name;
      }

      setResultados(novosResultados);
      setNomeArquivoPorDocumento(novosNomes);
      setSucessoDocumento({});
      setResultadoLinhas(null);
      setLinhas(
        novosResultados.flatMap((res) =>
          res.lancamentos.map((l, i) => ({
            key: `${res.documentoId}-${i}-${l.descricao}-${l.data}`,
            documentoId: res.documentoId,
            data: l.data,
            descricao: l.descricao,
            valorCentavos: l.valorCentavos,
            tipo: l.tipo,
            categoriaId: l.sugestao?.categoriaId ?? "",
            essencial: l.sugestao?.essencial ?? false,
            sugestaoOrigem: l.sugestao?.origem ?? null,
            parcela: l.parcelaSugerida ? `${l.parcelaSugerida.atual}/${l.parcelaSugerida.total}` : "",
          }))
        )
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao analisar a(s) fatura(s).");
    } finally {
      setAnalisando(false);
    }
  }

  function atualizarLinha(key: string, patch: Partial<LinhaRevisao>) {
    setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removerLinha(key: string) {
    setLinhas((prev) => prev.filter((l) => l.key !== key));
  }

  async function handleConfirmarTotais(documentoId: string, formData: FormData) {
    setErro(null);
    setSalvandoDocumento(documentoId);
    try {
      formData.set("documentoId", documentoId);
      await registrarCicloFatura(passivoId, formData);
      setSucessoDocumento((prev) => ({ ...prev, [documentoId]: true }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar o ciclo de fatura.");
    } finally {
      setSalvandoDocumento(null);
    }
  }

  async function handleConfirmarLinhas() {
    if (resultados.length === 0) return;
    setErro(null);
    setImportandoLinhas(true);
    try {
      let importados = 0;
      let duplicadosNaConfirmacao = 0;
      // Uma chamada por fatura de origem — confirmarImportacaoFatura já é
      // escopada por documentoId+passivoId, então agrupar por fatura em vez
      // de mandar tudo junto evita mexer na server action.
      for (const documentoId of new Set(linhas.map((l) => l.documentoId))) {
        const linhasDoDocumento = linhas.filter((l) => l.documentoId === documentoId);
        const res = await confirmarImportacaoFatura({
          documentoId,
          passivoId,
          lancamentos: linhasDoDocumento.map((l) => {
            const parcela = parseParcela(l.parcela);
            return {
              data: l.data,
              descricao: l.descricao,
              valorCentavos: l.valorCentavos,
              tipo: l.tipo,
              categoriaId: l.categoriaId || null,
              essencial: l.essencial,
              parcelaAtual: parcela?.atual ?? null,
              totalParcelas: parcela?.total ?? null,
            };
          }),
        });
        importados += res.importados;
        duplicadosNaConfirmacao += res.duplicadosNaConfirmacao;
      }
      setResultadoLinhas({ importados, duplicadosNaConfirmacao });
      setLinhas([]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao confirmar as compras da(s) fatura(s).");
    } finally {
      setImportandoLinhas(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAnalisar} className="flex flex-wrap items-end gap-4 glass-card rounded-2xl p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Cartão</label>
          <select value={passivoId} onChange={(e) => setPassivoId(e.target.value)} className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground">
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Arquivo(s) PDF</label>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
          {arquivos.length > 1 && (
            <span className="text-[11px] text-muted-foreground">
              {arquivos.length} arquivos selecionados — todos para o mesmo cartão escolhido acima.
            </span>
          )}
        </div>

        <Button type="submit" disabled={analisando}>
          {analisando ? "Analisando…" : arquivos.length > 1 ? `Analisar ${arquivos.length} faturas` : "Analisar"}
        </Button>
      </form>

      {erro && <p className="text-sm text-debt">{erro}</p>}

      {resultados.map((resultado) => (
        <form
          key={resultado.documentoId}
          action={(formData) => handleConfirmarTotais(resultado.documentoId, formData)}
          className="flex flex-col gap-4 glass-card rounded-2xl p-5"
        >
          <div>
            <h2 className="text-sm font-medium text-foreground">
              Totais da fatura
              {nomeArquivoPorDocumento[resultado.documentoId] && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({nomeArquivoPorDocumento[resultado.documentoId]})
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Usado nas contas de fôlego/veredito — independe da lista de compras abaixo.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Referência (ex: 2026-09) <span className="text-debt">*</span>
              </label>
              <input name="referencia" required className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Valor da fatura (R$) <span className="text-debt">*</span>
              </label>
              <input
                name="valor"
                type="text"
                inputMode="decimal"
                required
                defaultValue={resultado.candidato.valorCentavos != null ? centavosParaReais(resultado.candidato.valorCentavos) : undefined}
                className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
              {resultado.candidato.valorCentavos == null && (
                <span className="text-[11px] text-gold">não encontrado automaticamente — confira o PDF</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Valor mínimo (R$)</label>
              <input
                name="valorMinimo"
                type="text"
                inputMode="decimal"
                defaultValue={resultado.candidato.valorMinimoCentavos != null ? centavosParaReais(resultado.candidato.valorMinimoCentavos) : undefined}
                className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Vencimento</label>
              <input
                name="vencimento"
                type="date"
                defaultValue={resultado.candidato.vencimento ?? undefined}
                className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <Button type="submit" disabled={salvandoDocumento === resultado.documentoId}>
              {salvandoDocumento === resultado.documentoId ? "Salvando…" : "Confirmar e salvar totais"}
            </Button>
          </div>
          {sucessoDocumento[resultado.documentoId] && (
            <p className="rounded-lg border border-liquidity/20 bg-liquidity/[0.06] p-3 text-sm text-liquidity">
              Ciclo de fatura registrado.
            </p>
          )}
        </form>
      ))}

      {resultados.length > 0 && (
        <div className="flex flex-col gap-4 glass-card rounded-2xl p-5">
          <div>
            <h2 className="text-sm font-medium text-foreground">Compras da(s) fatura(s)</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Revise linha por linha — marque como &ldquo;essencial&rdquo; o que não pode deixar de existir,
              pra alimentar a tela de limite de cartão.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{linhas.length} lançamento(s) novo(s) para revisar</span>
            {totalDuplicadosIgnorados > 0 && (
              <span>{totalDuplicadosIgnorados} já importado(s) anteriormente — ignorado(s)</span>
            )}
          </div>

          {resultados.some((r) => r.linhasNaoReconhecidas.length > 0) && (
            <details className="rounded-lg border border-gold/20 bg-gold/[0.06] p-3 text-sm text-gold">
              <summary className="cursor-pointer font-medium">
                {resultados.reduce((acc, r) => acc + r.linhasNaoReconhecidas.length, 0)} linha(s) com data mas não
                reconhecida(s) — nada foi perdido, revise manualmente
              </summary>
              {resultados
                .filter((r) => r.linhasNaoReconhecidas.length > 0)
                .map((r) => (
                  <div key={r.documentoId} className="mt-2">
                    {nomeArquivoPorDocumento[r.documentoId] && (
                      <p className="text-xs font-medium">{nomeArquivoPorDocumento[r.documentoId]}</p>
                    )}
                    <ul className="mt-1 flex flex-col gap-1 font-mono text-xs">
                      {r.linhasNaoReconhecidas.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </details>
          )}

          {resultadoLinhas && (
            <p className="rounded-lg border border-liquidity/20 bg-liquidity/[0.06] p-3 text-sm text-liquidity">
              {resultadoLinhas.importados} compra(s) importada(s)
              {resultadoLinhas.duplicadosNaConfirmacao > 0 && `, ${resultadoLinhas.duplicadosNaConfirmacao} duplicada(s) ignorada(s)`}.
            </p>
          )}

          {linhas.length === 0 && !resultadoLinhas && (
            <p className="text-sm text-muted-foreground">
              Nenhuma linha de compra reconhecida automaticamente nesse PDF.
            </p>
          )}

          {linhas.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {resultados.length > 1 && <th className="px-3 py-2 font-medium">Fatura</th>}
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 font-medium text-right">Valor</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Categoria</th>
                    <th className="px-3 py-2 font-medium">Parcela</th>
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
                      {resultados.length > 1 && (
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {nomeArquivoPorDocumento[l.documentoId] ?? "—"}
                        </td>
                      )}
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
                            title="Aplica a categoria/essencial dessa linha às outras linhas parecidas desse mesmo lote"
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
                          onChange={(e) => atualizarLinha(l.key, { tipo: e.target.value as "DESPESA" | "ENTRADA" })}
                          className="rounded border border-input px-1.5 py-1 text-xs"
                        >
                          <option value="DESPESA">Despesa</option>
                          <option value="ENTRADA">Entrada/estorno</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={l.categoriaId}
                          onChange={(e) => atualizarLinha(l.key, { categoriaId: e.target.value })}
                          className="w-44 rounded border border-input px-1.5 py-1 text-xs"
                        >
                          <option value="">selecione…</option>
                          {opcoesCategoria.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={l.parcela}
                          onChange={(e) => atualizarLinha(l.key, { parcela: e.target.value })}
                          placeholder="ex: 2/10"
                          title="Atual/total de parcelas — deixe em branco se não for parcelado"
                          className="w-16 rounded border border-input px-1.5 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={l.essencial}
                          onChange={(e) => atualizarLinha(l.key, { essencial: e.target.checked })}
                          title="Marcar como despesa essencial recorrente (cria/atualiza uma Recorrência vinculada a este cartão)"
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
              <Button type="button" onClick={handleConfirmarLinhas} disabled={importandoLinhas}>
                {importandoLinhas ? "Importando…" : `Confirmar compras (${linhas.length})`}
              </Button>
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
