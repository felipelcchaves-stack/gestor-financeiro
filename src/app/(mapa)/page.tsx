import Link from "next/link";
import {
  Compass,
  AlertTriangle,
  Wallet,
  Bell,
  ListChecks,
  Route as RouteIcon,
  Zap,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Receipt,
} from "lucide-react";
import { formatarBRL, mesAnoDaquiA } from "@/lib/money";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularQualidadeDados } from "@/lib/qualidadeDados";
import { calcularMovimentacaoDoMes, calcularOfensoresPorCredor, inicioDoPeriodo } from "@/lib/ofensores";
import type { NivelSinal } from "@/lib/sinal";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { GraficoLinhaTemporal, type SerieLinhaTemporal } from "@/components/GraficoLinhaTemporal";
import { TrilhaDeSaida, type Estacao } from "./TrilhaDeSaida";
import { Termometro, formatarMesLabel } from "./Termometro";
import { definirAporteMensal, registrarSnapshotMensal, registrarSnapshotHistorico } from "./actions";

export const dynamic = "force-dynamic";

const ESTILO_SINAL: Record<NivelSinal, string> = {
  VERDE: "border-liquidity/25 bg-liquidity/[0.06] text-liquidity",
  AMARELO: "border-gold/25 bg-gold/[0.06] text-gold",
  VERMELHO: "border-debt/25 bg-debt/[0.06] text-debt",
};

export default async function MapaPage() {
  const [estado, qualidadeDados, movimentacaoDoMes, movimentacaoDoAno, ofensoresPorCredorDoAno] = await Promise.all([
    carregarEstadoAtual(),
    calcularQualidadeDados(),
    calcularMovimentacaoDoMes(inicioDoPeriodo("mes")),
    calcularMovimentacaoDoMes(inicioDoPeriodo("ano")),
    calcularOfensoresPorCredor(inicioDoPeriodo("ano")),
  ]);
  const {
    passivosQuitados,
    passivoTotal,
    patrimonio,
    elegiveis,
    proximasAcoes,
    sinal,
    vitoriaRapida,
    rota,
    snapshots,
    alertas,
    margemLivre,
  } = estado;

  const nomePorId = new Map(elegiveis.map((p) => [p.id, p]));
  const estacoes: Estacao[] = [
    ...passivosQuitados.map(
      (p): Estacao => ({
        id: p.id,
        nome: p.nome,
        saldoCentavos: 0,
        status: "quitado",
        mesEstimado: null,
      })
    ),
    ...(rota
      ? rota.resultado.ordemIds.map((id, i): Estacao => {
          const p = nomePorId.get(id)!;
          const quitacao = rota.resultado.quitacoes.find((q) => q.passivoId === id);
          return {
            id,
            nome: p.nome,
            saldoCentavos: p.saldoCentavos,
            status: i === 0 ? "atual" : "fila",
            mesEstimado: quitacao?.mes ?? null,
          };
        })
      : elegiveis.map((p): Estacao => ({ id: p.id, nome: p.nome, saldoCentavos: p.saldoCentavos, status: "fila", mesEstimado: null }))),
  ];

  const primeiraDaFila = rota ? nomePorId.get(rota.resultado.ordemIds[0]) : null;
  const primeiraQuitacao = rota?.resultado.quitacoes[0];

  const mesAtual = estado.hoje.toISOString().slice(0, 7);
  const jaRegistrouEsteMes = snapshots.some((s) => s.mesReferencia === mesAtual);

  const snapshotMaisAntigo = snapshots.length > 0 ? snapshots[0] : null;
  const temComparacaoDeDivida = snapshotMaisAntigo != null && snapshotMaisAntigo.mesReferencia !== mesAtual;
  const deltaDividaCentavos = temComparacaoDeDivida ? passivoTotal - snapshotMaisAntigo!.passivoTotalCentavos : 0;

  const saldoDoMesCentavos = movimentacaoDoMes.entradasCentavos - movimentacaoDoMes.despesasTotalCentavos;
  const saldoDoAnoCentavos = movimentacaoDoAno.entradasCentavos - movimentacaoDoAno.despesasTotalCentavos;
  const pagoEmDividasDoAnoCentavos = ofensoresPorCredorDoAno
    .filter((c) => c.id !== "sem-vinculo")
    .reduce((acc, c) => acc + c.totalCentavos, 0);
  const anoCorrente = estado.hoje.getFullYear();

  const dataMesAnterior = new Date(estado.hoje.getFullYear(), estado.hoje.getMonth() - 1, 1);
  const mesAnteriorMax = `${dataMesAnterior.getFullYear()}-${String(dataMesAnterior.getMonth() + 1).padStart(2, "0")}`;

  const serieDividaTotal: SerieLinhaTemporal[] = [
    {
      id: "divida",
      nome: "Dívida total",
      cor: "var(--debt)",
      pontos: snapshots.map((s) => ({
        label: `${formatarMesLabel(s.mesReferencia)}${s.confiabilidade === "ESTIMADO" ? " (lembrado)" : ""}`,
        valorCentavos: s.passivoTotalCentavos,
      })),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Rota de Saída" title="Meu Mapa" />

      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wider">Dívida total</p>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Hoje</p>
            <p className="num text-2xl font-semibold text-debt">{formatarBRL(passivoTotal)}</p>
          </div>

          {temComparacaoDeDivida && (
            <div className="border-l border-dashed border-border pl-8">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                Em {formatarMesLabel(snapshotMaisAntigo!.mesReferencia)}
              </p>
              <p className="num text-2xl font-semibold text-muted-foreground">
                {formatarBRL(snapshotMaisAntigo!.passivoTotalCentavos)}
              </p>
            </div>
          )}

          {temComparacaoDeDivida && (
            <div className="border-l border-dashed border-border pl-8">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Variação</p>
              <p
                className={`num flex items-center gap-1 text-2xl font-semibold ${
                  deltaDividaCentavos <= 0 ? "text-liquidity" : "text-debt"
                }`}
              >
                {deltaDividaCentavos <= 0 ? <TrendingDown className="size-5" /> : <TrendingUp className="size-5" />}
                {formatarBRL(Math.abs(deltaDividaCentavos))}
              </p>
            </div>
          )}
        </div>

        {!temComparacaoDeDivida && (
          <p className="mt-3 text-xs text-muted-foreground">
            Só existe um registro (hoje) — ainda não dá pra comparar com o passado.{" "}
            <a href="#documentar-mes-anterior" className="text-gold underline underline-offset-4">
              Documente um mês anterior que você lembra
            </a>{" "}
            pra ver evolução de verdade agora, sem esperar meses acumulando snapshot.
          </p>
        )}

        <p className="mt-3 text-sm text-foreground">
          {primeiraDaFila && primeiraQuitacao ? (
            <>
              Seguindo a rota recomendada, a próxima dívida a cair (
              <span className="font-medium">{primeiraDaFila.nome}</span>) zera em{" "}
              <span className="font-medium">{mesAnoDaquiA(primeiraQuitacao.mes)}</span>.
            </>
          ) : (
            "Ainda não dá pra calcular sua rota completa — falta 1 informação (veja abaixo)."
          )}
        </p>

        <p className="mt-2 text-xs text-muted-foreground">
          Patrimônio líquido atual: <span className="num">{formatarBRL(patrimonio)}</span> (ativos − passivos
          conhecidos; não é o saldo da sua conta bancária)
        </p>

        {qualidadeDados.passivosComReconciliacaoPendente.length > 0 && (
          <p className="mt-2 text-xs text-debt">
            {qualidadeDados.passivosComReconciliacaoPendente.length} passivo(s) com pagamento real pendente de
            confirmação — esse &ldquo;você deve&rdquo; e a rota abaixo podem estar desatualizados.{" "}
            <Link href="/relatorio" className="underline underline-offset-4">
              ver quais
            </Link>
          </p>
        )}
      </section>

      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Receipt className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wider">Balanço deste mês (extrato real)</p>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Entradas</p>
            <p className="num text-2xl font-semibold text-liquidity">{formatarBRL(movimentacaoDoMes.entradasCentavos)}</p>
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Despesas</p>
            <p className="num text-2xl font-semibold text-debt">{formatarBRL(movimentacaoDoMes.despesasTotalCentavos)}</p>
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo do mês</p>
            <p className={`num text-2xl font-semibold ${saldoDoMesCentavos >= 0 ? "text-liquidity" : "text-debt"}`}>
              {formatarBRL(saldoDoMesCentavos)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Direto do extrato importado — entradas e despesas que já aconteceram de verdade, não configuração/orçamento
          (isso é o card &ldquo;Fluxo do mês&rdquo; logo abaixo).
        </p>
      </section>

      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Receipt className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wider">Resumo de {anoCorrente}</p>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Entradas no ano</p>
            <p className="num text-2xl font-semibold text-liquidity">{formatarBRL(movimentacaoDoAno.entradasCentavos)}</p>
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Despesas no ano</p>
            <p className="num text-2xl font-semibold text-debt">{formatarBRL(movimentacaoDoAno.despesasTotalCentavos)}</p>
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo do ano</p>
            <p className={`num text-2xl font-semibold ${saldoDoAnoCentavos >= 0 ? "text-liquidity" : "text-debt"}`}>
              {formatarBRL(saldoDoAnoCentavos)}
            </p>
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pago em dívidas</p>
            <p className="num text-2xl font-semibold text-gold">{formatarBRL(pagoEmDividasDoAnoCentavos)}</p>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Desde 1º de janeiro de {anoCorrente}, direto do extrato real — &ldquo;Pago em dívidas&rdquo; é a parte das
          despesas que foi vinculada a algum passivo (subconjunto de &ldquo;Despesas no ano&rdquo;, não um valor
          extra). Zera sozinho a cada virada de ano.
        </p>
      </section>

      <section className={`flex items-start gap-3 rounded-2xl border p-4 ${ESTILO_SINAL[sinal.nivel]}`}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{sinal.titulo}</p>
          <p className="mt-0.5 text-sm text-foreground/80">{sinal.mensagem}</p>
        </div>
      </section>

      <section
        className={`rounded-2xl border p-5 ${
          margemLivre.margemConfirmadaCentavos <= 0 ? "border-debt/25 bg-debt/[0.06]" : "glass-card"
        }`}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wider">Fluxo do mês</p>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Confirmado <span className="text-liquidity">●</span>
            </p>
            <p
              className={`num text-2xl font-semibold ${
                margemLivre.margemConfirmadaCentavos <= 0 ? "text-debt" : "gold-text"
              }`}
            >
              {formatarBRL(margemLivre.margemConfirmadaCentavos)}
            </p>
          </div>

          {margemLivre.entradasEstimadasCentavos > 0 && (
            <div className="border-l border-dashed border-border pl-8">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                Projetado (com estimativa) <span className="text-gold">◌</span>
              </p>
              <p className="num text-2xl font-semibold text-muted-foreground/70 italic">
                {formatarBRL(margemLivre.margemLivreCentavos)}
              </p>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Baseado nas recorrências e no custo mensal das dívidas que você cadastrou — não é o extrato do banco
          importado.{" "}
          {margemLivre.margemConfirmadaCentavos <= 0 &&
            "Confirmado perto de zero ou negativo é o mesmo padrão que originou a crise — vale rever antes de seguir. "}
          {margemLivre.entradasEstimadasCentavos > 0 &&
            `O projetado inclui ${formatarBRL(margemLivre.entradasEstimadasCentavos)} de entrada ainda não confirmada.`}
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 border-t border-border pt-3 text-xs sm:grid-cols-3">
          <div className="flex items-center justify-between gap-2 sm:block">
            <dt className="text-muted-foreground">Entradas confirmadas</dt>
            <dd className="num text-foreground">{formatarBRL(margemLivre.entradasConfirmadasCentavos)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 sm:block">
            <dt className="text-muted-foreground">Despesas recorrentes</dt>
            <dd className="num text-debt">− {formatarBRL(margemLivre.despesasRecorrentesCentavos)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 sm:block">
            <dt className="text-muted-foreground">Parcelas dos passivos</dt>
            <dd className="num text-debt">− {formatarBRL(margemLivre.custoMensalPassivosCentavos)}</dd>
          </div>
          {margemLivre.aporteMensalExtraCentavos > 0 && (
            <div className="flex items-center justify-between gap-2 sm:block">
              <dt className="text-muted-foreground">Aporte de quitação</dt>
              <dd className="num text-debt">− {formatarBRL(margemLivre.aporteMensalExtraCentavos)}</dd>
            </div>
          )}
        </dl>
      </section>

      {alertas.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell className="size-4 text-gold" /> Alertas
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {alertas.map((alerta) => (
              <div key={alerta.titulo} className="rounded-2xl border border-gold/25 bg-gold/[0.06] p-4">
                <p className="text-sm font-medium text-gold">{alerta.titulo}</p>
                <p className="mt-0.5 text-sm text-foreground/80">{alerta.mensagem}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListChecks className="size-4 text-gold" /> O que fazer agora
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {proximasAcoes.map((acao) => (
            <div key={acao.titulo} className="glass-card rounded-2xl p-4">
              <p className="text-sm font-medium text-foreground">{acao.titulo}</p>
              <p className="mt-1 text-sm text-muted-foreground">{acao.descricao}</p>

              {acao.href && (
                <Button size="sm" className="mt-3" nativeButton={false} render={<Link href={acao.href} />}>
                  Resolver agora
                </Button>
              )}

              {!acao.href && acao.tipo === "tarefa" && (
                <form action={definirAporteMensal} className="mt-3 flex items-center gap-2">
                  <input
                    name="aporte"
                    type="text"
                    inputMode="decimal"
                    placeholder="ex: 10000"
                    required
                    className="w-32 rounded-lg border border-input bg-input/30 px-2 py-1 text-sm"
                  />
                  <Button type="submit" size="sm">
                    Salvar
                  </Button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {estacoes.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <RouteIcon className="size-4 text-gold" /> Sua rota de saída
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ordem calculada pelo menor juro total pago no total.{" "}
            <Link href="/otimizacao" className="text-gold underline underline-offset-4">
              Comparar com outras estratégias
            </Link>
            .
          </p>
          {rota && !rota.exaustivo && (
            <p className="mt-1 text-xs text-gold">
              Muitas dívidas do tipo &ldquo;só juros, sem amortização&rdquo; ao mesmo tempo — testar todas as
              combinações entre elas ficou inviável, então essa ordem usa uma regra aproximada (maior sangria mensal
              por real de saldo primeiro), sem garantia de ser o mínimo absoluto de juro.
            </p>
          )}
          <div className="mt-3">
            <TrilhaDeSaida estacoes={estacoes} />
          </div>
        </section>
      )}

      {vitoriaRapida && (
        <section className="rounded-2xl border border-gold/25 bg-gold/[0.06] p-5">
          <div className="flex items-center gap-2 text-gold">
            <Zap className="size-4" />
            <p className="text-xs font-semibold uppercase tracking-wider">Vitória rápida</p>
          </div>
          <p className="mt-2 text-sm text-foreground/90">
            <span className="font-medium">{vitoriaRapida.nome}</span> é a dívida mais fácil de matar
            perto do alívio de caixa que ela dá —{" "}
            <span className="num">{formatarBRL(vitoriaRapida.saldoCentavos)}</span> de saldo liberando{" "}
            <span className="num">{formatarBRL(vitoriaRapida.custoMensalCentavos)}</span>/mês quando cair.
          </p>
          <Link href="/ataque-rapido" className="mt-2 inline-block text-xs font-medium text-gold underline underline-offset-4">
            Simular só as dívidas pequenas
          </Link>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Thermometer className="size-4 text-gold" /> Seu termômetro
          </h2>
          {jaRegistrouEsteMes ? (
            <span className="text-xs text-muted-foreground">já registrado este mês</span>
          ) : (
            <form action={registrarSnapshotMensal}>
              <Button type="submit" variant="outline" size="sm">
                Registrar patrimônio deste mês
              </Button>
            </form>
          )}
        </div>
        <div className="glass-card mt-3 rounded-2xl p-4">
          <Termometro snapshots={snapshots} />
        </div>

        {snapshots.length > 0 && (
          <div className="mt-3">
            <GraficoLinhaTemporal
              series={serieDividaTotal}
              tituloEixo="Dívida total documentada, mês a mês"
              ariaLabel="Evolução da dívida total ao longo do tempo"
              mostrarTotalPeriodo={false}
            />
          </div>
        )}

        <details id="documentar-mes-anterior" className="mt-3">
          <summary className="cursor-pointer text-xs text-gold underline underline-offset-4">
            Documentar um mês anterior (de memória)
          </summary>
          <form
            action={registrarSnapshotHistorico}
            className="glass-card mt-3 flex flex-wrap items-end gap-3 rounded-2xl p-4"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Mês</label>
              <input
                type="month"
                name="mesReferencia"
                required
                max={mesAnteriorMax}
                className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Dívida total (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                name="passivoTotal"
                required
                placeholder="ex: 1450000"
                className="w-40 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Ativos totais (R$, opcional)</label>
              <input
                type="text"
                inputMode="decimal"
                name="ativoTotal"
                placeholder="deixe em branco se não lembrar"
                className="w-56 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <Button type="submit" size="sm">
              Documentar
            </Button>
          </form>
          <p className="mt-2 text-[11px] text-muted-foreground/70">
            Nunca calculado pelo sistema — o número que você lembra, marcado como estimativa (círculo vazado no
            gráfico), só pra dar um ponto de partida até acumular snapshots reais mês a mês.
          </p>
        </details>
      </section>

      <div className="flex flex-wrap gap-4 text-xs text-gold">
        <Link href="/resumo" className="underline underline-offset-4">
          Ver resumo completo
        </Link>
        <Link href="/otimizacao" className="underline underline-offset-4">
          Comparar estratégias
        </Link>
        <Link href="/ataque-rapido" className="underline underline-offset-4">
          Ataque rápido às dívidas pequenas
        </Link>
        <Link href="/resumo/ia" className="underline underline-offset-4">
          Gerar resumo para revisar com IA
        </Link>
        <Link href="/relatorio/categorias" className="underline underline-offset-4">
          Relatório por categoria (despesa e receita)
        </Link>
        <Link href="/cofre" className="underline underline-offset-4">
          Cofre (reserva pra dívida)
        </Link>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Compass className="size-3" /> Precisa recomeçar do zero? Use o assistente de configuração no menu.
      </p>
    </div>
  );
}
