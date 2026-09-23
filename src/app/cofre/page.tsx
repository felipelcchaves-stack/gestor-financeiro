import Link from "next/link";
import { PiggyBank, Target, Zap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarBRL, mesAnoDaquiA } from "@/lib/money";
import { calcularProgressoMeta } from "@/lib/metrics";
import { calcularStatusRateio } from "@/lib/rateio";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularAlvosOportunistas } from "@/lib/alvosOportunistas";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SugestaoIA } from "@/components/SugestaoIA";
import { criarMetaCofre, gerarSugestaoParaMeta, obterUltimaSugestaoMeta } from "./actions";
import { resolverAlvoDaMeta, calcularProjecaoMeta, calcularPrioridadeMeta } from "@/lib/projecaoMeta";
import type { SugestaoGerada } from "@/app/resumo/ia/actions";

export const dynamic = "force-dynamic";

export default async function CofrePage() {
  const estado = await carregarEstadoAtual();
  const statusRateio = await calcularStatusRateio(estado);

  const [metas, passivosDisponiveis] = await Promise.all([
    statusRateio
      ? prisma.meta.findMany({
          where: { contaOrigemId: statusRateio.contaDestinoId },
          include: { passivosAlvo: { include: { passivo: true } }, alocacoes: true },
          orderBy: { dataAlvo: "asc" },
        })
      : Promise.resolve([]),
    prisma.passivo.findMany({
      where: { status: "ATIVO" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, valorQuitacaoCentavos: true },
    }),
  ]);

  // Passivos que já têm meta criada nesse cofre — usado tanto pra
  // esconder sugestões obsoletas (alvoSugerido/alvos oportunistas)
  // quanto pra ordenar a lista de metas por prioridade real.
  const passivoIdsComMeta = new Set(metas.flatMap((m) => m.passivosAlvo.map((mp) => mp.passivoId)));

  // Sugestão salva de cada meta (se já foi gerada alguma vez) — a
  // projeção ("fecha em X meses") é recalculada aqui, não guardada no
  // cache, pra sempre refletir o saldo ATUAL do cofre (já carregado
  // acima em statusRateio), nunca um número congelado de quando a
  // sugestão foi gerada.
  const sugestoesSalvas = await Promise.all(metas.map((m) => obterUltimaSugestaoMeta(m.id)));
  const sugestaoInicialPorMeta = new Map<string, SugestaoGerada | null>(
    metas.map((meta, i) => {
      const salva = sugestoesSalvas[i];
      if (!salva || !statusRateio) return [meta.id, null];
      const alvo = resolverAlvoDaMeta(
        meta,
        meta.passivosAlvo.map((mp) => mp.passivo)
      );
      const saldoCofreCentavos = statusRateio.contaDestinoSaldoCentavos ?? 0;
      const projecao = calcularProjecaoMeta(alvo.saldoCentavos, saldoCofreCentavos, salva.cortes);
      return [meta.id, { ...salva, projecao }];
    })
  );

  // Data-alvo real pra criar uma meta com um clique — só existe quando
  // a rota de menor juro já foi simulada (aporte mensal extra
  // configurado em Consultor). Sem isso, não inventamos prazo nenhum.
  // Reaproveitado tanto pro alvoSugerido quanto pros alvos oportunistas.
  function dataDaquiAMeses(meses: number | null): string | null {
    if (meses == null) return null;
    return new Date(estado.hoje.getFullYear(), estado.hoje.getMonth() + meses, 1).toISOString().slice(0, 10);
  }

  const dataAlvoSugeridaISO = dataDaquiAMeses(statusRateio?.alvoSugerido?.mesQuitacaoProjetado ?? null);
  const alvoJaEhQuitavel = statusRateio?.alvoSugerido?.passivoId === statusRateio?.dividaQuitavel?.passivoId;

  // Alvos "fora da fila" — dívidas menores que o saldo atual do cofre já
  // cobriria (ou cobriria em breve), mesmo sem ser a próxima da rota de
  // menor juro. Ver src/lib/alvosOportunistas.ts pro raciocínio.
  const alvosOportunistas = statusRateio
    ? calcularAlvosOportunistas(
        estado,
        statusRateio.contaDestinoSaldoCentavos ?? 0,
        statusRateio.alvoSugerido?.passivoId ?? null,
        passivoIdsComMeta
      )
    : [];

  // "Mapa" de prioridade: mesma rota de menor juro já usada em toda
  // parte (nunca um critério novo), recalculada do zero a cada
  // carregamento — nunca uma prioridade congelada.
  const ordemRota = estado.rota?.resultado.ordemIds;
  const metasComPrioridade = metas
    .map((meta) => ({
      meta,
      prioridade: calcularPrioridadeMeta(
        meta.passivosAlvo.map((mp) => mp.passivoId),
        ordemRota
      ),
    }))
    .sort((a, b) => {
      if (a.prioridade == null && b.prioridade == null) return 0;
      if (a.prioridade == null) return 1;
      if (b.prioridade == null) return -1;
      return a.prioridade - b.prioridade;
    });
  // Rótulo "1ª, 2ª, ..." é a posição RELATIVA entre as metas com
  // prioridade calculada — não o índice bruto na rota (que pode ter
  // buracos, ex: 0, 3, 7, se nem todo passivo da rota tem meta).
  let proximoRotulo = 1;
  const rotuloPorMetaId = new Map<string, number>();
  for (const { meta, prioridade } of metasComPrioridade) {
    if (prioridade != null) rotuloPorMetaId.set(meta.id, proximoRotulo++);
  }

  if (!statusRateio) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Ferramentas"
          title="Cofre"
          description="Reserva de receita separada especificamente pra quitar dívida."
        />
        <p className="text-sm text-muted-foreground">
          O rateio automático ainda não está configurado.{" "}
          <Link href="/consultor" className="text-gold underline underline-offset-4">
            Configure em Consultor
          </Link>{" "}
          (categoria de receita, % a separar e conta destino) pra começar a ver os indicadores aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Ferramentas"
        title="Cofre"
        description={`${statusRateio.percentual}% da receita de ${statusRateio.categoriaNome} separado pra ${statusRateio.contaDestinoNome}, pra quitar dívida.`}
      />

      <p className="text-xs text-muted-foreground">
        As sugestões abaixo são recalculadas toda vez que o saldo do cofre ou um extrato muda — vão continuar
        aparecendo aqui, uma atrás da outra, até todo passivo elegível ter uma meta. O menu ao lado mostra quantas
        estão pendentes agora, então não precisa lembrar de voltar aqui pra conferir.
      </p>

      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <PiggyBank className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wider">Indicadores</p>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo atual</p>
            <p className="num text-2xl font-semibold text-liquidity">
              {statusRateio.contaDestinoSaldoCentavos != null
                ? formatarBRL(statusRateio.contaDestinoSaldoCentavos)
                : "não informado"}
            </p>
            {statusRateio.contaDestinoSaldoAtualizadoEm && (
              <p className="text-[11px] text-muted-foreground/70">
                atualizado em {new Date(statusRateio.contaDestinoSaldoAtualizadoEm).toLocaleDateString("pt-BR")}{" "}
                — <Link href="/contas" className="underline underline-offset-4">atualizar</Link>
              </p>
            )}
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Separado desde {new Date(statusRateio.ativoDesde).toLocaleDateString("pt-BR")}
            </p>
            <p className="num text-2xl font-semibold text-foreground">{formatarBRL(statusRateio.totalDepositadoCentavos)}</p>
          </div>
          <div className="border-l border-dashed border-border pl-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Meta ({statusRateio.percentual}%)</p>
            <p className="num text-2xl font-semibold text-foreground">{formatarBRL(statusRateio.metaSepararCentavos)}</p>
            <p className="text-[11px] text-muted-foreground/70">
              de {formatarBRL(statusRateio.totalRecebidoCentavos)} recebidos de {statusRateio.categoriaNome}
            </p>
          </div>
          {statusRateio.faltaSepararCentavos > 0 && (
            <div className="border-l border-dashed border-border pl-8">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Falta separar</p>
              <p className="num text-2xl font-semibold text-gold">{formatarBRL(statusRateio.faltaSepararCentavos)}</p>
            </div>
          )}
        </div>

        {statusRateio.dividaQuitavel && (
          <p className="mt-4 rounded-lg border border-debt/30 bg-debt/[0.06] p-3 text-sm text-debt">
            Esse saldo já cobre{" "}
            <Link href={`/passivos/${statusRateio.dividaQuitavel.passivoId}`} className="font-medium underline underline-offset-4">
              {statusRateio.dividaQuitavel.nome}
            </Link>{" "}
            ({formatarBRL(statusRateio.dividaQuitavel.valorQuitacaoCentavos)}) inteira — a próxima da rota de menor
            juro entre as que cabem no saldo.
          </p>
        )}

        {statusRateio.alvoSugerido && !alvoJaEhQuitavel && (
          <div className="mt-4 rounded-lg border border-gold/30 bg-gold/[0.06] p-4">
            <p className="text-sm text-gold">
              O alvo mais eficiente pra essa reserva agora é{" "}
              <Link
                href={`/passivos/${statusRateio.alvoSugerido.passivoId}`}
                className="font-medium underline underline-offset-4"
              >
                {statusRateio.alvoSugerido.nome}
              </Link>{" "}
              — é a próxima dívida na rota de menor juro (custo mensal{" "}
              {formatarBRL(statusRateio.alvoSugerido.custoMensalCentavos)}, saldo{" "}
              {formatarBRL(statusRateio.alvoSugerido.valorQuitacaoCentavos)}). Faltam{" "}
              {formatarBRL(statusRateio.alvoSugerido.faltaParaQuitarCentavos)} pro cofre cobrir ela inteira
              {statusRateio.alvoSugerido.mesQuitacaoProjetado != null &&
                ` — a rota atual projeta quitação em ${mesAnoDaquiA(statusRateio.alvoSugerido.mesQuitacaoProjetado)}`}
              .
            </p>
            {passivoIdsComMeta.has(statusRateio.alvoSugerido.passivoId) ? (
              <p className="mt-2 text-xs text-gold/80">Já existe uma meta pra esse alvo — ver na lista abaixo.</p>
            ) : dataAlvoSugeridaISO ? (
              <form action={criarMetaCofre.bind(null, statusRateio.contaDestinoId)} className="mt-3">
                <input type="hidden" name="passivosAlvo" value={statusRateio.alvoSugerido.passivoId} />
                <input type="hidden" name="nome" value={`Quitar ${statusRateio.alvoSugerido.nome}`} />
                <input type="hidden" name="dataAlvo" value={dataAlvoSugeridaISO} />
                <Button type="submit" size="sm" variant="outline">
                  Criar meta pra esse alvo
                </Button>
              </form>
            ) : (
              <p className="mt-2 text-xs text-gold/80">
                Configure um aporte mensal extra em{" "}
                <Link href="/consultor" className="underline underline-offset-4">
                  Consultor
                </Link>{" "}
                pra ver a data projetada e criar essa meta com um clique.
              </p>
            )}
          </div>
        )}
      </section>

      {alvosOportunistas.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Zap className="size-4 text-gold" /> Outras dívidas que esse cofre já poderia aliviar
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Não é a rota de menor juro (essa continua sendo {statusRateio.alvoSugerido?.nome ?? "a prioridade acima"})
            — é fluxo de caixa: quitar uma dívida menor libera a parcela mensal dela mesmo sem ser a próxima da fila.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {alvosOportunistas.map((alvo) => {
              const dataAlvoISO = dataDaquiAMeses(alvo.mesQuitacaoProjetado);
              return (
                <div key={alvo.passivoId} className="glass-card rounded-2xl p-4">
                  <p className="text-sm text-foreground">
                    <Link href={`/passivos/${alvo.passivoId}`} className="font-medium text-gold underline underline-offset-4">
                      {alvo.nome}
                    </Link>{" "}
                    — custo mensal {formatarBRL(alvo.custoMensalCentavos)}, saldo {formatarBRL(alvo.saldoCentavos)}.{" "}
                    {alvo.jaQuitavel ? (
                      <>O saldo atual do cofre já cobre essa dívida inteira.</>
                    ) : (
                      <>
                        Faltam {formatarBRL(alvo.faltaParaQuitarCentavos)} pro cofre cobrir ela inteira
                        {alvo.mesQuitacaoProjetado != null && ` — a rota atual projeta quitação em ${mesAnoDaquiA(alvo.mesQuitacaoProjetado)}`}
                        .
                      </>
                    )}
                  </p>
                  {alvo.aceleracao && (
                    <p className="mt-2 text-sm text-liquidity">
                      Quitando essa dívida e redirecionando os {formatarBRL(alvo.custoMensalCentavos)}/mês liberados pro
                      aporte extra, {alvo.aceleracao.alvoPrincipalNome} fecha{" "}
                      <strong>{alvo.aceleracao.mesesAdiantados} {alvo.aceleracao.mesesAdiantados === 1 ? "mês" : "meses"} mais cedo</strong>{" "}
                      (mês {alvo.aceleracao.mesComAceleracao} em vez do mês {alvo.aceleracao.mesAtual} da rota atual).
                    </p>
                  )}
                  {dataAlvoISO && (
                    <form action={criarMetaCofre.bind(null, statusRateio.contaDestinoId)} className="mt-3">
                      <input type="hidden" name="passivosAlvo" value={alvo.passivoId} />
                      <input type="hidden" name="nome" value={`Quitar ${alvo.nome}`} />
                      <input type="hidden" name="dataAlvo" value={dataAlvoISO} />
                      <Button type="submit" size="sm" variant="outline">
                        Criar meta pra esse alvo
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Target className="size-4 text-gold" /> Metas financiadas por este cofre
          </h2>
        </div>

        {metas.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma meta cadastrada pra esse cofre ainda.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {metasComPrioridade.map(({ meta }) => {
              const rotulo = rotuloPorMetaId.get(meta.id);
              const progresso = calcularProgressoMeta(
                meta,
                meta.passivosAlvo.map((mp) => mp.passivo),
                meta.alocacoes
              );
              // Progresso à parte, baseado no saldo real do cofre — o
              // valorFaltanteCentavos acima já reflete o saldo do
              // passivo (se documentado); este é literalmente "quanto
              // do que já tenho guardado aqui cobre essa meta",
              // crescendo à medida que o saldo do Bradesco sobe.
              const saldoCofreCentavos = statusRateio.contaDestinoSaldoCentavos ?? 0;
              const progressoCofrePctExato =
                meta.valorAlvoCentavos > 0 ? Math.min(100, (saldoCofreCentavos / meta.valorAlvoCentavos) * 100) : 0;
              // Arredondar pra inteiro esconde um progresso real mas
              // pequeno (ex: 0,07% vira "0%", parecendo que nada
              // mudou) — mostra 1 casa decimal só nesse caso raro.
              const progressoCofrePctLabel =
                progressoCofrePctExato > 0 && progressoCofrePctExato < 1
                  ? `${progressoCofrePctExato.toFixed(1).replace(".", ",")}%`
                  : `${Math.round(progressoCofrePctExato)}%`;
              // Largura da barra nunca fica visualmente zerada quando
              // há saldo real, mesmo que o percentual arredonde pra 0.
              const progressoCofreBarraPct =
                progressoCofrePctExato > 0 ? Math.max(progressoCofrePctExato, 1) : 0;
              return (
                <div key={meta.id} className="glass-card rounded-2xl p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-medium text-foreground">{meta.nome}</h3>
                    <div className="flex shrink-0 items-center gap-2">
                      {rotulo != null ? (
                        <span
                          className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold"
                          title="Posição na rota de menor juro — recalculada a cada carregamento, nunca fixa."
                        >
                          {rotulo}ª prioridade
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          fora da rota agora
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          meta.status === "ATIVA" ? "bg-liquidity/[0.06] text-liquidity" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {meta.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Data-alvo: {new Date(meta.dataAlvo).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Falta {formatarBRL(progresso.valorFaltanteCentavos)}
                    {progresso.ritmoNecessarioCentavos != null && `, ritmo necessário ${formatarBRL(progresso.ritmoNecessarioCentavos)}/mês`}
                  </p>

                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                      <span>Coberto pelo saldo do cofre</span>
                      <span className="num">{progressoCofrePctLabel}</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${progressoCofrePctExato >= 100 ? "bg-liquidity" : "bg-gold"}`}
                        style={{ width: `${progressoCofreBarraPct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {formatarBRL(saldoCofreCentavos)} de {formatarBRL(meta.valorAlvoCentavos)} — sobe conforme o
                      saldo de {statusRateio.contaDestinoNome} for atualizado.
                    </p>
                  </div>

                  <Link href="/metas" className="mt-2 inline-block text-xs text-gold underline underline-offset-4">
                    editar em Metas
                  </Link>

                  <div className="mt-3 border-t border-border pt-3">
                    <SugestaoIA
                      sugestaoInicial={sugestaoInicialPorMeta.get(meta.id) ?? null}
                      acaoGerar={gerarSugestaoParaMeta.bind(null, meta.id)}
                      titulo={`Corte agressivo pra fechar ${meta.nome}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-gold underline underline-offset-4">
            Nova meta financiada por este cofre
          </summary>
          <form
            action={criarMetaCofre.bind(null, statusRateio.contaDestinoId)}
            className="mt-3 flex flex-col gap-4 glass-card rounded-2xl p-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Nome</label>
                <input
                  name="nome"
                  required
                  className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Valor-alvo (R$) — opcional se marcar passivo-alvo com saldo documentado
                </label>
                <input
                  name="valorAlvo"
                  type="text"
                  inputMode="decimal"
                  className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Data-alvo</label>
                <input
                  name="dataAlvo"
                  type="date"
                  required
                  className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Passivos-alvo</label>
              <div className="mt-1 flex flex-col gap-1 rounded border border-border p-2">
                {passivosDisponiveis.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" name="passivosAlvo" value={p.id} />
                    {p.nome}
                    {p.valorQuitacaoCentavos != null && (
                      <span className="text-muted-foreground">— {formatarBRL(p.valorQuitacaoCentavos)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Button type="submit">Criar meta</Button>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}
