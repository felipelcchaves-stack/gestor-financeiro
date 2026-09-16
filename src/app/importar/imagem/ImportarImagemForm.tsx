"use client";

import { useState } from "react";
import { confirmarLancamentoImagem } from "./actions";
import { criarCategoriaAction } from "@/app/categorias/actions";
import { Button } from "@/components/ui/button";
import { ordenarCategoriasHierarquicamente, type CategoriaOpcao } from "@/lib/categorias";

type Opcao = { id: string; nome: string };
type VinculoTipo = "NENHUM" | "PASSIVO" | "ATIVO" | "META";

export function ImportarImagemForm({
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
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriasState, setCategoriasState] = useState(categorias);
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [novaCategoriaParentId, setNovaCategoriaParentId] = useState("");
  const [vinculo, setVinculo] = useState<{ tipo: VinculoTipo; id: string }>({ tipo: "NENHUM", id: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const opcoesCategoria = ordenarCategoriasHierarquicamente(categoriasState);

  async function confirmarNovaCategoria() {
    if (novaCategoriaNome.trim().length === 0) return;
    const nova = await criarCategoriaAction(novaCategoriaNome, novaCategoriaParentId || null);
    setCategoriasState((prev) => [...prev, { id: nova.id, nome: nova.nome, parentId: nova.parentId }]);
    setCategoriaId(nova.id);
    setCriandoCategoria(false);
  }

  async function handleSubmit(formData: FormData) {
    setErro(null);
    if (!categoriaId) {
      setErro("Selecione uma categoria.");
      return;
    }
    formData.set("categoriaId", categoriaId);
    formData.set("vinculoTipo", vinculo.tipo);
    if (vinculo.tipo !== "NENHUM") formData.set("vinculoId", vinculo.id);

    setSalvando(true);
    try {
      await confirmarLancamentoImagem(formData);
      setSucesso(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar o lançamento.");
    } finally {
      setSalvando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-lg border border-liquidity/20 bg-liquidity/[0.06] p-4 text-sm text-liquidity">
          Lançamento salvo com a imagem anexada.
        </p>
        <button
          type="button"
          onClick={() => setSucesso(false)}
          className="w-fit rounded border border-input px-3 py-1.5 text-sm"
        >
          Lançar outro
        </button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 glass-card rounded-2xl p-5">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Imagem <span className="text-debt">*</span>
        </label>
        <input name="arquivo" type="file" accept="image/*" required className="text-sm" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Conta <span className="text-debt">*</span>
          </label>
          <select name="contaId" required className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground">
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Data <span className="text-debt">*</span>
          </label>
          <input name="data" type="date" required className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground" />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">
            Descrição <span className="text-debt">*</span>
          </label>
          <input name="descricao" required className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Valor (R$) <span className="text-debt">*</span>
          </label>
          <input name="valor" type="text" inputMode="decimal" required className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <select name="tipo" className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground">
            <option value="DESPESA">Despesa</option>
            <option value="ENTRADA">Entrada</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Categoria <span className="text-debt">*</span>
          </label>
          {criandoCategoria ? (
            <div className="flex flex-col gap-1">
              <input
                autoFocus
                placeholder="Nome da categoria"
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
                className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
              <select
                value={novaCategoriaParentId}
                onChange={(e) => setNovaCategoriaParentId(e.target.value)}
                className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
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
                <button type="button" onClick={confirmarNovaCategoria} className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  Criar
                </button>
                <button type="button" onClick={() => setCriandoCategoria(false)} className="rounded border border-input px-2 py-0.5 text-xs">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <select
              value={categoriaId}
              onChange={(e) => (e.target.value === "__nova__" ? setCriandoCategoria(true) : setCategoriaId(e.target.value))}
              className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
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
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Vínculo</label>
          <select
            value={vinculo.tipo === "NENHUM" ? "NENHUM" : `${vinculo.tipo}:${vinculo.id}`}
            onChange={(e) => {
              if (e.target.value === "NENHUM") setVinculo({ tipo: "NENHUM", id: "" });
              else {
                const [tipo, id] = e.target.value.split(":");
                setVinculo({ tipo: tipo as VinculoTipo, id });
              }
            }}
            className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
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
        </div>
      </div>

      {erro && <p className="text-sm text-debt">{erro}</p>}

      <div>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Confirmar e salvar"}
        </Button>
      </div>
    </form>
  );
}
