import Link from "next/link";
import { List } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import { parseNumeroBR, reaisParaCentavos } from "@/lib/money";
import { normalizarDescricao, calcularSimilaridadeDescricao } from "@/lib/classificacao";
import { TransacoesTable, type TransacaoLinha } from "./TransacoesTable";
import { GruposSugeridosSheet } from "./GruposSugeridosSheet";
import { ordenarCategoriasHierarquicamente, calcularTipoPredominantePorCategoria } from "@/lib/categorias";
import { inicioDoPeriodo, type Periodo } from "@/lib/ofensores";

const LABEL_PERIODO: Record<Periodo, string> = {
  mes: "Este mês",
  trimestre: "Trimestre",
  semestre: "6 meses",
  ano: "Este ano",
  tudo: "Todo o histórico",
};

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  extrato: "Extrato",
  fatura: "Fatura",
  imagem: "Imagem",
  contrato: "Contrato",
};

const ORIGEM_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  EXTRATO_IMPORTADO: "Extrato importado",
  FATURA_IMPORTADA: "Fatura importada",
  IMAGEM: "Imagem",
};

type FiltroAtual = {
  tipo?: string;
  semCategoria?: string;
  semVinculo?: string;
  transferencia?: string;
  q?: string;
  valor?: string;
  categoriaId?: string;
  parecido?: string;
  periodo?: string;
};

function hrefComFiltro(atual: FiltroAtual, mudanca: Partial<FiltroAtual>) {
  const params = new URLSearchParams();
  const combinado = { ...atual, ...mudanca };
  if (combinado.tipo) params.set("tipo", combinado.tipo);
  if (combinado.semCategoria) params.set("semCategoria", combinado.semCategoria);
  if (combinado.semVinculo) params.set("semVinculo", combinado.semVinculo);
  if (combinado.transferencia) params.set("transferencia", combinado.transferencia);
  if (combinado.q) params.set("q", combinado.q);
  if (combinado.valor) params.set("valor", combinado.valor);
  if (combinado.categoriaId) params.set("categoriaId", combinado.categoriaId);
  if (combinado.parecido) params.set("parecido", combinado.parecido);
  if (combinado.periodo) params.set("periodo", combinado.periodo);
  const query = params.toString();
  return query ? `/transacoes?${query}` : "/transacoes";
}

// Limiar da busca "credor parecido": mais permissivo que o limiar de 0.6
// usado na sugestão automática de importação (sugerirClassificacao),
// porque aqui é o Felipe olhando o resultado e decidindo o que selecionar
// — vale mostrar mais candidatos com o score visível do que esconder um
// credor de verdade parecido por um limiar rígido demais.
const LIMIAR_SIMILARIDADE_BUSCA = 0.4;

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    semCategoria?: string;
    semVinculo?: string;
    transferencia?: string;
    q?: string;
    valor?: string;
    categoriaId?: string;
    parecido?: string;
    periodo?: string;
    importados?: string;
    duplicados?: string;
  }>;
}) {
  const {
    tipo: tipoRaw,
    semCategoria: semCategoriaRaw,
    semVinculo: semVinculoRaw,
    transferencia: transferenciaRaw,
    q,
    valor: valorRaw,
    categoriaId,
    parecido: parecidoRaw,
    periodo: periodoRaw,
    importados,
    duplicados,
  } = await searchParams;
  const tipo = tipoRaw === "ENTRADA" || tipoRaw === "DESPESA" ? tipoRaw : undefined;
  const semCategoria = semCategoriaRaw === "1";
  const semVinculo = semVinculoRaw === "1";
  const transferencia = transferenciaRaw === "1";
  const parecido = parecidoRaw === "1";
  const periodo: Periodo =
    periodoRaw === "mes" || periodoRaw === "trimestre" || periodoRaw === "semestre" || periodoRaw === "ano"
      ? periodoRaw
      : "tudo";
  const filtroAtual: FiltroAtual = {
    tipo: tipoRaw,
    semCategoria: semCategoriaRaw,
    semVinculo: semVinculoRaw,
    transferencia: transferenciaRaw,
    q,
    valor: valorRaw,
    categoriaId,
    parecido: parecidoRaw,
    periodo: periodoRaw,
  };

  // "q", "valor" e "parecido" filtram em memória (contains/similaridade sem
  // suporte nativo no SQLite via Prisma, e o volume de transações aqui é
  // pessoal — não justifica índice/full-text). O resto do where já reduz o
  // que precisa ser trazido do banco antes desse filtro.
  const valorBuscadoCentavos = valorRaw ? reaisParaCentavos(parseNumeroBR(valorRaw) ?? NaN) : null;
  const qNormalizado = q ? normalizarDescricao(q) : null;

  const where: Prisma.TransacaoWhereInput = {
    ...(tipo ? { tipo } : {}),
    ...(semCategoria ? { categoriaId: null } : {}),
    ...(semVinculo ? { passivoId: null, ativoId: null, alocacaoMeta: null } : {}),
    ...(transferencia ? { ehTransferencia: true } : {}),
    ...(categoriaId ? { categoriaId } : {}),
    data: { gte: inicioDoPeriodo(periodo) },
  };

  // Sem corte de quantidade aqui — 1.000+ transações com os relacionamentos
  // já incluídos não pesa pra SQLite local nem pra renderizar numa tabela.
  // O corte que existia (200, sempre, mesmo navegando sem nenhuma busca)
  // escondia histórico em silêncio depois de uma importação grande — o
  // cabeçalho mostrava "200 lançamento(s)" como se fosse o total.
  const [
    transacoesRaw,
    categorias,
    totalSemCategoria,
    totalSemVinculo,
    totalTransferencia,
    passivos,
    ativos,
    metas,
    contas,
    contagensCategoriaTipo,
  ] = await Promise.all([
    prisma.transacao.findMany({
      where,
      include: {
        categoria: { include: { parent: true } },
        conta: true,
        passivo: true,
        ativo: true,
        alocacaoMeta: { include: { meta: true } },
        documento: true,
      },
      orderBy: { data: "desc" },
    }),
    prisma.categoria.findMany({ orderBy: { nome: "asc" } }),
    prisma.transacao.count({ where: { categoriaId: null } }),
    prisma.transacao.count({ where: { passivoId: null, ativoId: null, alocacaoMeta: null } }),
    prisma.transacao.count({ where: { ehTransferencia: true } }),
    prisma.passivo.findMany({ where: { status: "ATIVO" }, orderBy: { nome: "asc" } }),
    prisma.ativo.findMany({ orderBy: { nome: "asc" } }),
    prisma.meta.findMany({ where: { status: "ATIVA" }, orderBy: { nome: "asc" } }),
    prisma.conta.findMany({ orderBy: { nome: "asc" } }),
    prisma.transacao.groupBy({
      by: ["categoriaId", "tipo"],
      _count: { _all: true },
      where: { categoriaId: { not: null } },
    }),
  ]);

  const tipoPorCategoria = calcularTipoPredominantePorCategoria(
    contagensCategoriaTipo.map((c) => ({ categoriaId: c.categoriaId!, tipo: c.tipo, quantidade: c._count._all }))
  );

  const comSemelhanca = transacoesRaw.map((t) => ({
    t,
    semelhanca:
      qNormalizado && parecido ? calcularSimilaridadeDescricao(qNormalizado, normalizarDescricao(t.descricao)) : null,
  }));

  const candidatos = comSemelhanca
    .filter(({ t, semelhanca }) => {
      if (!qNormalizado) return true;
      if (parecido) return (semelhanca ?? 0) >= LIMIAR_SIMILARIDADE_BUSCA;
      return normalizarDescricao(t.descricao).includes(qNormalizado);
    })
    .filter(({ t }) =>
      valorBuscadoCentavos != null && !Number.isNaN(valorBuscadoCentavos) ? t.valorCentavos === valorBuscadoCentavos : true
    )
    .sort((a, b) => (parecido ? (b.semelhanca ?? 0) - (a.semelhanca ?? 0) : 0));

  // O corte de 200 continua existindo só como salvaguarda pra busca
  // aproximada/valor em memória (que pode devolver muita coisa parecida) —
  // navegar sem busca nenhuma sempre mostra tudo que bate com o período.
  const limiteExibicao = qNormalizado || valorBuscadoCentavos != null ? 200 : undefined;
  const totalCorrespondente = candidatos.length;
  const transacoesFiltradas = candidatos.slice(0, limiteExibicao);

  const transacoes: TransacaoLinha[] = transacoesFiltradas.map(({ t, semelhanca }) => ({
    id: t.id,
    data: t.data.toISOString(),
    descricao: t.descricao,
    valorCentavos: t.valorCentavos,
    tipo: t.tipo,
    categoriaId: t.categoriaId,
    origem: t.origem,
    origemLabel: ORIGEM_LABEL[t.origem] ?? t.origem,
    conta: t.conta?.nome ?? null,
    categoria: t.categoria
      ? t.categoria.parent
        ? `${t.categoria.parent.nome} — ${t.categoria.nome}`
        : t.categoria.nome
      : null,
    vinculo: t.passivo?.nome ?? t.ativo?.nome ?? t.alocacaoMeta?.meta.nome ?? null,
    // ENTRADA vinculada a um Passivo é desembolso de empréstimo, não
    // receita — o dinheiro entrou de verdade, mas é dívida nova.
    ehDesembolsoDeEmprestimo: t.tipo === "ENTRADA" && t.passivoId != null,
    ehTransferencia: t.ehTransferencia,
    contaDestinoId: t.contaDestinoId,
    semelhancaPct: semelhanca != null ? Math.round(semelhanca * 100) : null,
    documento: t.documento
      ? {
          id: t.documento.id,
          nomeArquivo: t.documento.nomeArquivo,
          tipoLabel: TIPO_LABEL[t.documento.tipo] ?? t.documento.tipo,
          extensao: t.documento.caminhoArquivo.slice(t.documento.caminhoArquivo.lastIndexOf(".")),
        }
      : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Dados"
        title="Transações"
        description={`${
          transacoesFiltradas.length < totalCorrespondente
            ? `${transacoesFiltradas.length} de ${totalCorrespondente}`
            : `${transacoes.length}`
        } lançamento(s)${semCategoria ? " sem categoria" : ""}${
          tipo === "DESPESA" ? " · despesas" : tipo === "ENTRADA" ? " · receitas" : ""
        }`}
        action={
          <GruposSugeridosSheet
            categorias={categorias}
            tipoPorCategoria={tipoPorCategoria}
            passivos={passivos.map((p) => ({ id: p.id, nome: p.nome }))}
            ativos={ativos.map((a) => ({ id: a.id, nome: a.nome }))}
            metas={metas.map((m) => ({ id: m.id, nome: m.nome }))}
            filtro={{ tipo, periodo, categoriaId }}
          />
        }
      />

      {importados != null && (
        <p className="rounded-lg border border-liquidity/20 bg-liquidity/[0.06] p-4 text-sm text-liquidity">
          {importados} lançamento(s) importado(s) com sucesso.
          {duplicados != null && Number(duplicados) > 0 && (
            <> {duplicados} já existente(s) foram ignorado(s) como duplicata.</>
          )}
        </p>
      )}

      {transacoesFiltradas.length < totalCorrespondente && (
        <p className="text-xs text-gold">
          Mostrando só os {transacoesFiltradas.length} mais relevantes de {totalCorrespondente} encontrados —
          refine a busca (descrição, valor ou categoria) pra ver o resto.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={hrefComFiltro(filtroAtual, { tipo: undefined })}
          className={`rounded-lg px-3 py-1 ${!tipo ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"}`}
        >
          Todas
        </Link>
        <Link
          href={hrefComFiltro(filtroAtual, { tipo: "ENTRADA" })}
          className={`rounded-lg px-3 py-1 ${tipo === "ENTRADA" ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"}`}
        >
          Receitas
        </Link>
        <Link
          href={hrefComFiltro(filtroAtual, { tipo: "DESPESA" })}
          className={`rounded-lg px-3 py-1 ${tipo === "DESPESA" ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"}`}
        >
          Despesas
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-muted-foreground">período:</span>
        {(Object.keys(LABEL_PERIODO) as Periodo[]).map((p) => (
          <Link
            key={p}
            href={hrefComFiltro(filtroAtual, { periodo: p === "tudo" ? undefined : p })}
            className={`rounded-lg px-3 py-1 ${
              periodo === p ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"
            }`}
          >
            {LABEL_PERIODO[p]}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link
          href={hrefComFiltro(filtroAtual, { semCategoria: undefined })}
          className={`rounded-lg px-3 py-1 ${!semCategoria ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"}`}
        >
          Todas
        </Link>
        <Link
          href={hrefComFiltro(filtroAtual, { semCategoria: "1" })}
          className={`rounded-lg px-3 py-1 ${semCategoria ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"}`}
        >
          Sem categoria
        </Link>
        {totalSemCategoria > 0 && (
          <span className="text-xs text-muted-foreground">
            {totalSemCategoria} transação(ões) sem categoria no total
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link
          href={hrefComFiltro(filtroAtual, { semVinculo: undefined })}
          className={`rounded-lg px-3 py-1 ${!semVinculo ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"}`}
        >
          Todas
        </Link>
        <Link
          href={hrefComFiltro(filtroAtual, { semVinculo: "1" })}
          className={`rounded-lg px-3 py-1 ${semVinculo ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"}`}
        >
          Sem vínculo
        </Link>
        {totalSemVinculo > 0 && (
          <span className="text-xs text-muted-foreground">
            {totalSemVinculo} transação(ões) sem passivo/ativo/meta vinculado no total — os pagamentos reais não
            atualizam o saldo dos passivos sem esse vínculo.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link
          href={hrefComFiltro(filtroAtual, { transferencia: undefined })}
          className={`rounded-lg px-3 py-1 ${!transferencia ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"}`}
        >
          Todas
        </Link>
        <Link
          href={hrefComFiltro(filtroAtual, { transferencia: "1" })}
          className={`rounded-lg px-3 py-1 ${transferencia ? "bg-gold/10 text-gold" : "border border-input text-muted-foreground"}`}
        >
          Transferências
        </Link>
        {totalTransferencia > 0 && (
          <span className="text-xs text-muted-foreground">
            {totalTransferencia} transação(ões) marcada(s) como transferência no total — dinheiro que só mudou de
            conta, não conta como gasto ou receita nos relatórios de ofensor.
          </span>
        )}
      </div>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 glass-card rounded-2xl p-3 text-sm"
      >
        {tipoRaw && <input type="hidden" name="tipo" value={tipoRaw} />}
        {semCategoriaRaw && <input type="hidden" name="semCategoria" value={semCategoriaRaw} />}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            {parecido ? "Descrição parecida com" : "Descrição contém"}
          </label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="ex: dizimo, uber…"
            className="w-48 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" title="Encontra também credores com descrição parecida (não idêntica) — útil pra achar variações do mesmo PIX/credor, não só texto igual.">
            <input type="checkbox" name="parecido" value="1" defaultChecked={parecido} />
            credor parecido
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Valor exato (R$)</label>
          <input
            name="valor"
            type="text"
            inputMode="decimal"
            defaultValue={valorRaw ?? ""}
            placeholder="ex: 250,00"
            className="w-32 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Categoria atual</label>
          <select
            name="categoriaId"
            defaultValue={categoriaId ?? ""}
            className="w-48 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">todas</option>
            {ordenarCategoriasHierarquicamente(categorias).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Filtrar
        </button>
        {(q || valorRaw || categoriaId) && (
          <Link
            href={hrefComFiltro(filtroAtual, { q: undefined, valor: undefined, categoriaId: undefined, parecido: undefined })}
            className="text-xs text-muted-foreground/70 hover:text-foreground hover:underline"
          >
            limpar busca
          </Link>
        )}
      </form>

      {transacoes.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <List className="size-4" />
          {semCategoria || semVinculo || tipo || q || valorRaw || categoriaId || periodo !== "tudo" ? (
            "Nenhuma transação encontrada com esse filtro."
          ) : (
            <>
              Nenhuma transação ainda. Use{" "}
              <a href="/importar/extrato" className="text-gold underline underline-offset-4">
                Importar extrato
              </a>{" "}
              para começar.
            </>
          )}
        </p>
      ) : (
        <TransacoesTable
          transacoes={transacoes}
          categorias={categorias}
          passivos={passivos.map((p) => ({ id: p.id, nome: p.nome }))}
          ativos={ativos.map((a) => ({ id: a.id, nome: a.nome }))}
          metas={metas.map((m) => ({ id: m.id, nome: m.nome }))}
          contas={contas.map((c) => ({ id: c.id, nome: c.nome }))}
        />
      )}
    </div>
  );
}
