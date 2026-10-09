"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatarBRL } from "@/lib/money";
import { ordenarCategoriasHierarquicamente, type CategoriaOpcao } from "@/lib/categorias";
import { buscarGruposSugeridos, atualizarCategoriaEmLote, atualizarVinculoEmLote, type VinculoTipoLote } from "./actions";
import type { GrupoSugerido } from "@/lib/agrupamentoTransacoes";
import type { Periodo } from "@/lib/ofensores";
import type { TipoTransacao } from "@/generated/prisma";

type Opcao = { id: string; nome: string };

// Mesmo padrão de selo já usado em src/app/consultor/page.tsx
// (VEREDICTO_CLASSES) — reaproveitado aqui pra natureza do grupo.
const NATUREZA_CLASSES: Record<"despesa" | "receita" | "emprestimo", string> = {
  despesa: "bg-debt/[0.06] text-debt border-debt/20",
  emprestimo: "bg-debt/[0.06] text-debt border-debt/20",
  receita: "bg-liquidity/[0.06] text-liquidity border-liquidity/20",
};

export function GruposSugeridosSheet({
  categorias,
  tipoPorCategoria,
  passivos,
  ativos,
  metas,
  filtro,
}: {
  categorias: CategoriaOpcao[];
  tipoPorCategoria: Record<string, TipoTransacao>;
  passivos: Opcao[];
  ativos: Opcao[];
  metas: Opcao[];
  filtro: { tipo?: "ENTRADA" | "DESPESA"; periodo?: Periodo; categoriaId?: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [grupos, setGrupos] = useState<GrupoSugerido[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, { categoriaId: string; vinculo: string }>>({});
  const [aplicandoChave, setAplicandoChave] = useState<string | null>(null);

  const opcoesCategoria = ordenarCategoriasHierarquicamente(categorias);

  async function carregar() {
    setCarregando(true);
    try {
      const resultado = await buscarGruposSugeridos(filtro);
      setGrupos(resultado);
      setEscolhas(
        Object.fromEntries(
          resultado.map((g) => [
            g.chave,
            {
              categoriaId: g.categoriaIdSugerida ?? "",
              vinculo: g.vinculoSugerido ? `${g.vinculoSugerido.tipo}:${g.vinculoSugerido.id}` : "",
            },
          ])
        )
      );
      setCarregado(true);
    } finally {
      setCarregando(false);
    }
  }

  function handleOpenChange(novoOpen: boolean) {
    setOpen(novoOpen);
    if (novoOpen && !carregado) carregar();
  }

  async function aplicarGrupo(grupo: GrupoSugerido) {
    const escolha = escolhas[grupo.chave];
    if (!escolha) return;

    setAplicandoChave(grupo.chave);
    try {
      if (escolha.categoriaId) {
        await atualizarCategoriaEmLote(grupo.transacaoIds, escolha.categoriaId);
      }
      if (escolha.vinculo) {
        const [tipo, id] = escolha.vinculo.split(":");
        await atualizarVinculoEmLote(grupo.transacaoIds, tipo as VinculoTipoLote, id);
      }
      setGrupos((prev) => prev.filter((g) => g.chave !== grupo.chave));
      router.refresh();
    } finally {
      setAplicandoChave(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <Sparkles className="size-3.5" /> Ver sugestões de agrupamento
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sugestões de agrupamento</SheetTitle>
          <SheetDescription>
            Transações parecidas (mesma descrição ou mesmo valor repetido) que ainda faltam categoria ou vínculo —
            aplique a um grupo inteiro de uma vez.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-4">
          {carregando && <p className="text-sm text-muted-foreground">Procurando grupos parecidos…</p>}

          {!carregando && carregado && grupos.length === 0 && (
            <p className="text-sm text-liquidity">Nenhum grupo pendente encontrado nesse filtro — tudo já resolvido.</p>
          )}

          {grupos.map((grupo) => {
            const escolha = escolhas[grupo.chave] ?? { categoriaId: "", vinculo: "" };
            const escolhaVinculoTipo = escolha.vinculo.split(":")[0] as VinculoTipoLote | "";
            const ehDesembolsoDeEmprestimo =
              grupo.tipo === "ENTRADA" &&
              (grupo.vinculoSugerido?.tipo === "PASSIVO" || escolhaVinculoTipo === "PASSIVO");
            const naturezaChave: "despesa" | "receita" | "emprestimo" =
              grupo.tipo === "DESPESA" ? "despesa" : ehDesembolsoDeEmprestimo ? "emprestimo" : "receita";
            const naturezaLabel =
              naturezaChave === "despesa" ? "despesa" : naturezaChave === "emprestimo" ? "empréstimo recebido" : "receita";
            const corValor = grupo.tipo === "DESPESA" || ehDesembolsoDeEmprestimo ? "text-debt" : "text-liquidity";

            // Categoria já usada historicamente com o tipo oposto ao do
            // grupo fica de fora — categoria nunca usada (sem sinal no
            // mapa) continua aparecendo pros dois tipos. A categoria já
            // escolhida/sugerida nunca é escondida, mesmo se divergir,
            // pra não invalidar o value do select.
            const opcoesCategoriaFiltradas = opcoesCategoria.filter((o) => {
              const tipoConhecido = tipoPorCategoria[o.id];
              return tipoConhecido == null || tipoConhecido === grupo.tipo || o.id === escolha.categoriaId;
            });

            return (
              <div key={grupo.chave} className="flex flex-col gap-2 glass-card rounded-2xl p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{grupo.exemploDescricao}</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${NATUREZA_CLASSES[naturezaChave]}`}>
                      {naturezaLabel}
                    </span>
                    <span className={`num text-sm ${corValor}`}>
                      {grupo.tipo === "DESPESA" ? "-" : "+"}
                      {formatarBRL(grupo.totalCentavos)}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {grupo.transacaoIds.length} transações · agrupadas por {grupo.criterio === "descricao" ? "descrição parecida" : "valor repetido"}
                </p>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Categoria</label>
                    <select
                      value={escolha.categoriaId}
                      onChange={(e) =>
                        setEscolhas((prev) => ({ ...prev, [grupo.chave]: { ...escolha, categoriaId: e.target.value } }))
                      }
                      className="w-40 rounded-lg border border-input bg-input/30 px-2 py-1 text-xs text-foreground"
                    >
                      <option value="">nenhuma</option>
                      {opcoesCategoriaFiltradas.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Vínculo</label>
                    <select
                      value={escolha.vinculo}
                      onChange={(e) =>
                        setEscolhas((prev) => ({ ...prev, [grupo.chave]: { ...escolha, vinculo: e.target.value } }))
                      }
                      className="w-40 rounded-lg border border-input bg-input/30 px-2 py-1 text-xs text-foreground"
                    >
                      <option value="">nenhum</option>
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

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => aplicarGrupo(grupo)}
                    disabled={aplicandoChave === grupo.chave || (!escolha.categoriaId && !escolha.vinculo)}
                  >
                    {aplicandoChave === grupo.chave ? "Aplicando…" : "Aplicar a esse grupo"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
