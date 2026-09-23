import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularConsultor } from "@/lib/consultor";
import { calcularScoreSaude } from "@/lib/score";
import { calcularOportunidadesRenegociacao } from "@/lib/renegociacao";
import { calcularQualidadeDados } from "@/lib/qualidadeDados";
import { calcularArbitragemGarantia } from "@/lib/arbitragemGarantia";
import { calcularStatusRateio } from "@/lib/rateio";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { definirTaxaReferencia, definirRateio } from "./actions";
import { AlocacaoEntradaPontual } from "./AlocacaoEntradaPontual";
import { SimuladorQuitacaoAVista } from "./SimuladorQuitacaoAVista";
import { ScoreGauge } from "@/components/ScoreGauge";

export const dynamic = "force-dynamic";

const VEREDICTO_LABEL: Record<string, string> = {
  QUITAR_PRIORITARIO: "Quitar prioritário",
  MANTER_MINIMO: "Manter mínimo, investir a sobra",
  SEM_DADO: "Sem dado suficiente",
};

const VEREDICTO_CLASSES: Record<string, string> = {
  QUITAR_PRIORITARIO: "bg-debt/[0.06] text-debt border-debt/20",
  MANTER_MINIMO: "bg-liquidity/[0.06] text-liquidity border-liquidity/20",
  SEM_DADO: "bg-muted text-muted-foreground border-border",
};

const FAIXA_CLASSES: Record<string, string> = {
  SAUDAVEL: "text-liquidity",
  ATENCAO: "text-gold",
  CRITICO: "text-debt",
};

export default async function ConsultorPage() {
  const [estado, contas, qualidadeDados, ativosComVinculos, statusRateio, categorias] = await Promise.all([
    carregarEstadoAtual(),
    prisma.conta.findMany(),
    calcularQualidadeDados(),
    prisma.ativo.findMany({ include: { vinculos: { include: { passivo: true } } } }),
    calcularStatusRateio(),
    prisma.categoria.findMany({ orderBy: { nome: "asc" } }),
  ]);
  const arbitragemGarantia = calcularArbitragemGarantia(ativosComVinculos);
  const idsPassivosAtivos = new Set(estado.passivosAtivos.map((p) => p.id));
  const pendentesNestaTela = qualidadeDados.passivosComReconciliacaoPendente.filter((p) => idsPassivosAtivos.has(p.id));

  const saldoLiquidoContasCentavos = contas
    .filter((c) => c.tipo !== "CARTAO_CREDITO")
    .reduce((acc, c) => acc + Math.max(0, c.saldoAtualCentavos ?? 0), 0);

  const resultado = calcularConsultor({
    passivosAtivos: estado.passivosAtivos,
    saldoLiquidoContasCentavos,
    despesasRecorrentesMensaisCentavos: estado.margemLivre.despesasRecorrentesCentavos,
    margemLivreCentavos: estado.margemLivre.margemLivreCentavos,
    taxaReferenciaMensalPct: estado.configuracao?.taxaReferenciaMensalPct ?? null,
  });

  const alertaChequeEspecial = estado.alertas.filter((a) => a.tipo === "CHEQUE_ESPECIAL");
  const alertaFatura = estado.alertas.find((a) => a.tipo === "FATURA_CRESCENDO");

  const score = calcularScoreSaude({
    reservaAtualCentavos: resultado.reservaAtualCentavos,
    reservaAlvoCentavos: resultado.reservaAlvoCentavos,
    temFolego: resultado.temFolego,
    chequeEspecialEmUso: alertaChequeEspecial.length > 0,
    faturaCrescendo: alertaFatura != null,
    faturaCrescendoPassivoId: alertaFatura?.passivoId,
    rateioOk: statusRateio == null || statusRateio.faltaSepararCentavos === 0,
  });

  const oportunidadesRenegociacao = calcularOportunidadesRenegociacao(estado.passivosAtivos);

  const passivosParaAVista = estado.passivosAtivos
    .filter((p) => p.valorQuitacaoCentavos != null)
    .map((p) => ({ id: p.id, nome: p.nome, saldoCentavos: p.valorQuitacaoCentavos! }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Ferramentas"
        title="Consultor"
        description="Olha suas dívidas, seu fôlego de caixa e sua reserva de emergência, e te diz o que priorizar agora — matemática pura, sem IA generativa, sem enviar seus dados pra fora."
      />

      <div className="glass-card flex items-center gap-2 rounded-2xl p-5">
        <ScoreGauge pontos={score.pontos} faixa={score.faixa} />
        <div>
          <p className={`text-sm font-medium ${FAIXA_CLASSES[score.faixa]}`}>{score.label}</p>
          <p className="text-xs text-muted-foreground">
            Score de saúde financeira — reserva de emergência, margem livre, cheque especial e fatura de cartão.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <p className="text-sm font-medium text-foreground">Como chegar a 100</p>
        {score.pontos === 100 ? (
          <p className="mt-2 text-sm text-liquidity">Você já está com o score máximo — os 4 fatores estão em dia.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {score.fatores
              .filter((f) => f.pontosAtuais < f.pontosMaximos)
              .map((f) => (
                <li key={f.nome} className="text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium text-foreground">{f.nome}</span>
                    <span className="num text-xs text-muted-foreground">
                      {f.pontosAtuais}/{f.pontosMaximos} pontos
                    </span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {f.dica}
                    {f.href && (
                      <>
                        {" "}
                        <Link href={f.href} className="text-gold underline underline-offset-4">
                          resolver
                        </Link>
                      </>
                    )}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </div>

      {pendentesNestaTela.length > 0 && (
        <div className="rounded-lg border border-debt/30 bg-debt/[0.06] p-4 text-sm text-debt">
          <p className="font-medium">Pagamento real pendente de confirmação</p>
          <p className="mt-1">
            {pendentesNestaTela.length} passivo(s) já têm uma transação vinculada que muda o saldo, mas isso ainda
            não foi confirmado — os vereditos e o simulador à vista abaixo podem estar usando saldo desatualizado.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {pendentesNestaTela.map((p) => (
              <li key={p.id}>
                <Link href={`/passivos/${p.id}`} className="underline underline-offset-4">
                  {p.nome}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {alertaChequeEspecial.length > 0 && (
        <div className="rounded-lg border border-debt/20 bg-debt/[0.06] p-4 text-sm text-debt">
          <p className="font-medium">Antes de qualquer coisa nessa lista: resolva o cheque especial.</p>
          {alertaChequeEspecial.map((a) => (
            <p key={a.titulo} className="mt-1">
              {a.titulo} — {a.mensagem} É a dívida mais cara que existe, sempre prioridade sobre qualquer coisa
              abaixo.
            </p>
          ))}
        </div>
      )}

      {!resultado.reservaOk && (
        <div className="rounded-lg border border-gold/20 bg-gold/[0.06] p-4 text-sm text-gold">
          <p className="font-medium">Complete sua reserva de emergência antes de acelerar quitação.</p>
          <p className="mt-1">
            Você tem {formatarBRL(resultado.reservaAtualCentavos)} guardado, e a meta (3 meses de despesas
            recorrentes) é {formatarBRL(resultado.reservaAlvoCentavos)} — faltam{" "}
            {formatarBRL(resultado.reservaAlvoCentavos - resultado.reservaAtualCentavos)}. Sem essa reserva, qualquer
            imprevisto vira dívida nova.
          </p>
        </div>
      )}

      {!resultado.temFolego && (
        <div className="rounded-lg border border-debt/20 bg-debt/[0.06] p-4 text-sm text-debt">
          Sua margem livre mensal está zerada ou negativa — não há sobra de caixa pra atacar dívida agora. Antes de
          seguir os vereditos abaixo, o foco deveria ser ajustar orçamento ou renda.{" "}
          <Link href="/ofensores" className="underline underline-offset-4">
            Ver maiores ofensores
          </Link>
          .
        </div>
      )}

      {arbitragemGarantia.length > 0 && (
        <div className="rounded-lg border border-debt/30 bg-debt/[0.06] p-4 text-sm">
          <p className="font-medium text-debt">Vale mais resgatar investimento e quitar</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Esses investimentos garantem dívidas que custam mais juro do que eles rendem — enquanto ficam presos em
            garantia em vez de quitar a dívida, a diferença é dinheiro perdido todo mês.
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {arbitragemGarantia.map((a) => (
              <li key={a.ativoId}>
                <div className="flex items-center justify-between">
                  <Link href={`/ativos/${a.ativoId}`} className="font-medium text-foreground underline underline-offset-4">
                    {a.ativoNome}
                  </Link>
                  <span className="text-debt">{formatarBRL(a.custoMensalTotalCentavos)}/mês</span>
                </div>
                <ul className="mt-1 flex flex-col gap-0.5 pl-3">
                  {a.oportunidades.map((o) => (
                    <li key={o.passivoId} className="flex items-center justify-between text-xs text-muted-foreground">
                      <Link href={`/passivos/${o.passivoId}`} className="underline underline-offset-4">
                        {o.passivoNome}
                      </Link>
                      <span>
                        {o.taxaJurosPct}% a.m. vs. {a.rendimentoMensalPct}% a.m. do investimento
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {oportunidadesRenegociacao.length > 0 && (
        <div className="rounded-lg border border-gold/20 bg-gold/[0.06] p-4 text-sm text-gold">
          <p className="font-medium">Oportunidades de renegociação/portabilidade</p>
          <p className="mt-1 text-xs text-gold/80">
            Faixa de mercado é uma referência geral aproximada, não um dado oficial nem específico do seu contrato.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {oportunidadesRenegociacao.map((o) => (
              <li key={o.passivoId}>
                <span className="font-medium">{o.nome}</span>: {o.mensagem}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-card rounded-2xl p-5">
        <p className="text-sm font-medium text-foreground">Taxa de referência (tipo CDI)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Usada pra comparar com a taxa de cada dívida — se o juro da dívida for maior que essa referência, vale
          mais quitar do que investir a sobra.
        </p>
        <form action={definirTaxaReferencia} className="mt-3 flex items-center gap-2">
          <input
            name="taxa"
            type="text"
            inputMode="decimal"
            defaultValue={estado.configuracao?.taxaReferenciaMensalPct ?? undefined}
            placeholder="ex: 0.9"
            className="w-28 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
          <span className="text-xs text-muted-foreground">% ao mês</span>
          <Button type="submit" size="sm">
            Salvar
          </Button>
        </form>
        {estado.configuracao?.taxaReferenciaMensalPct == null && (
          <p className="mt-2 text-[11px] text-muted-foreground/70">
            Ainda não definida — os vereditos abaixo assumem 0% (qualquer juro documentado é tratado como prioridade
            de quitação).
          </p>
        )}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <p className="text-sm font-medium text-foreground">Reserva pra dívida (rateio automático)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Separe um % de toda receita de uma categoria pra uma conta à parte — um cofre já reservado pra quitar
          dívida, nunca tratado como despesa. Você marca manualmente cada transferência (aba Transações, campo
          "Conta destino") pra contar aqui.
        </p>

        {statusRateio && (
          <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-border pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Saldo em {statusRateio.contaDestinoNome}
              </p>
              <p className="num text-2xl font-semibold text-liquidity">
                {statusRateio.contaDestinoSaldoCentavos != null
                  ? formatarBRL(statusRateio.contaDestinoSaldoCentavos)
                  : "não informado"}
              </p>
              {statusRateio.contaDestinoSaldoAtualizadoEm && (
                <p className="text-[11px] text-muted-foreground/70">
                  atualizado em {new Date(statusRateio.contaDestinoSaldoAtualizadoEm).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
            <div className="border-l border-dashed border-border pl-8">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Separado desde {new Date(statusRateio.ativoDesde).toLocaleDateString("pt-BR")}
              </p>
              <p className="num text-2xl font-semibold text-foreground">
                {formatarBRL(statusRateio.totalDepositadoCentavos)}
              </p>
              <p className="text-[11px] text-muted-foreground/70">
                meta: {statusRateio.percentual}% de {formatarBRL(statusRateio.totalRecebidoCentavos)} recebidos de{" "}
                {statusRateio.categoriaNome} = {formatarBRL(statusRateio.metaSepararCentavos)}
              </p>
            </div>
            {statusRateio.faltaSepararCentavos > 0 && (
              <div className="border-l border-dashed border-border pl-8">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Falta separar</p>
                <p className="num text-2xl font-semibold text-gold">{formatarBRL(statusRateio.faltaSepararCentavos)}</p>
              </div>
            )}
          </div>
        )}

        {statusRateio?.dividaQuitavel && (
          <p className="mt-3 rounded-lg border border-debt/30 bg-debt/[0.06] p-3 text-sm text-debt">
            Seu cofre já tem {formatarBRL(statusRateio.contaDestinoSaldoCentavos ?? 0)} — dá pra quitar{" "}
            <Link href={`/passivos/${statusRateio.dividaQuitavel.passivoId}`} className="font-medium underline underline-offset-4">
              {statusRateio.dividaQuitavel.nome}
            </Link>{" "}
            ({formatarBRL(statusRateio.dividaQuitavel.valorQuitacaoCentavos)}) inteira agora — é a que mais te custou
            de verdade nos últimos 6 meses entre as que cabem no saldo.
          </p>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-gold underline underline-offset-4">
            {statusRateio ? "Editar regra do rateio" : "Configurar rateio"}
          </summary>
          <form action={definirRateio} className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Categoria de receita</label>
              <select
                name="categoriaRateioId"
                required
                defaultValue={estado.configuracao?.categoriaRateioId ?? ""}
                className="w-56 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">selecione…</option>
                {categorias
                  .filter((c) => c.parentId === null)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">% a separar</label>
              <input
                name="percentualRateio"
                type="number"
                min={1}
                max={100}
                required
                defaultValue={estado.configuracao?.percentualRateio ?? 50}
                className="w-20 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Conta destino (cofre)</label>
              <select
                name="contaRateioDestinoId"
                required
                defaultValue={estado.configuracao?.contaRateioDestinoId ?? ""}
                className="w-48 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">selecione…</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm">
              Salvar
            </Button>
          </form>
        </details>
      </div>

      <AlocacaoEntradaPontual resultado={resultado} />

      <SimuladorQuitacaoAVista passivos={passivosParaAVista} resultado={resultado} />

      <div className="flex flex-col gap-3">
        {resultado.veredictos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum passivo ativo pra avaliar.</p>
        ) : (
          resultado.veredictos.map((v) => (
            <div key={v.passivoId} className="glass-card rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{v.nome}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VEREDICTO_CLASSES[v.veredicto]}`}
                >
                  {VEREDICTO_LABEL[v.veredicto]}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{v.motivo}</p>
              {v.taxaJurosPct == null && (
                <Link href={`/passivos/${v.passivoId}/editar`} className="mt-1 inline-block text-xs text-gold underline underline-offset-4">
                  documentar taxa de juro
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
