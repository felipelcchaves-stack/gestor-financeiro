import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/money";
import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularConsultor, alocarEntradaPontual, type ResultadoConsultor } from "@/lib/consultor";
import { calcularScoreSaude } from "@/lib/score";
import { calcularMaioresOfensores, calcularTendenciaMensal, calcularMaioresVariacoes, inicioDoPeriodo } from "@/lib/ofensores";
import { calcularProgressoMeta } from "@/lib/metrics";
import { calcularQualidadeDados } from "@/lib/qualidadeDados";
import { PageHeader } from "@/components/PageHeader";
import { ScoreGauge } from "@/components/ScoreGauge";

export const dynamic = "force-dynamic";

function gerarAcaoPrioritaria(
  totalEntradasPontuaisCentavos: number,
  alocacao: ReturnType<typeof alocarEntradaPontual> | null,
  resultadoConsultor: ResultadoConsultor
): string {
  if (alocacao && alocacao.length > 0) {
    const partes = alocacao.map((a) => {
      if (a.destino === "RESERVA") return `completar a reserva de emergência (${formatarBRL(a.valorCentavos)})`;
      if (a.destino === "PASSIVO") return `quitar ${a.detalhe} (${formatarBRL(a.valorCentavos)})`;
      return `investir a sobra (${formatarBRL(a.valorCentavos)})`;
    });
    return `Você tem ${formatarBRL(totalEntradasPontuaisCentavos)} em entradas pontuais previstas (recorrências marcadas como "única" — 13º, campanhas, restituição etc.). Se elas realmente acontecerem, a ordem de prioridade é: ${partes.join(" → ")}.`;
  }

  const prioritario = resultadoConsultor.veredictos.find((v) => v.veredicto === "QUITAR_PRIORITARIO");
  if (prioritario) {
    return `Nenhuma entrada pontual prevista no momento. Estruturalmente, a prioridade é ${prioritario.nome}: ${prioritario.motivo}`;
  }

  return "Nenhuma entrada pontual prevista e nenhuma dívida com taxa documentada acima da referência agora. O passo de maior alavancagem é documentar a taxa de juro das dívidas que ainda não têm — o Consultor não consegue avaliar prioridade sem isso.";
}

export default async function RelatorioPage() {
  const [estado, contas, entradasPontuais, ofensores, qualidadeDados, tendenciaCategoria] = await Promise.all([
    carregarEstadoAtual(),
    prisma.conta.findMany(),
    prisma.recorrenciaFinanceira.findMany({ where: { tipo: "ENTRADA", frequencia: "UNICA", ativa: true } }),
    calcularMaioresOfensores(inicioDoPeriodo("mes")),
    calcularQualidadeDados(),
    calcularTendenciaMensal(inicioDoPeriodo("trimestre"), "categoria"),
  ]);

  const maioresVariacoes = calcularMaioresVariacoes(tendenciaCategoria).slice(0, 5);

  const saldoLiquidoContasCentavos = contas
    .filter((c) => c.tipo !== "CARTAO_CREDITO")
    .reduce((acc, c) => acc + Math.max(0, c.saldoAtualCentavos ?? 0), 0);

  const resultadoConsultor = calcularConsultor({
    passivosAtivos: estado.passivosAtivos,
    saldoLiquidoContasCentavos,
    despesasRecorrentesMensaisCentavos: estado.margemLivre.despesasRecorrentesCentavos,
    margemLivreCentavos: estado.margemLivre.margemLivreCentavos,
    taxaReferenciaMensalPct: estado.configuracao?.taxaReferenciaMensalPct ?? null,
  });

  const alertaChequeEspecial = estado.alertas.filter((a) => a.tipo === "CHEQUE_ESPECIAL");
  const alertaFatura = estado.alertas.find((a) => a.tipo === "FATURA_CRESCENDO");

  const score = calcularScoreSaude({
    reservaAtualCentavos: resultadoConsultor.reservaAtualCentavos,
    reservaAlvoCentavos: resultadoConsultor.reservaAlvoCentavos,
    temFolego: resultadoConsultor.temFolego,
    chequeEspecialEmUso: alertaChequeEspecial.length > 0,
    faturaCrescendo: alertaFatura != null,
    faturaCrescendoPassivoId: alertaFatura?.passivoId,
  });

  const totalEntradasPontuaisCentavos = entradasPontuais.reduce((acc, r) => acc + r.valorCentavos, 0);
  const alocacaoPontual =
    totalEntradasPontuaisCentavos > 0 ? alocarEntradaPontual(totalEntradasPontuaisCentavos, resultadoConsultor) : null;
  const acaoPrioritaria = gerarAcaoPrioritaria(totalEntradasPontuaisCentavos, alocacaoPontual, resultadoConsultor);

  const metasComProgresso = estado.metasAtivas.map((m) => ({
    meta: m,
    progresso: calcularProgressoMeta(
      m,
      m.passivosAlvo.map((p) => p.passivo),
      m.alocacoes
    ),
  }));

  const fatoresPendentes = score.fatores.filter((f) => f.pontosAtuais < f.pontosMaximos);

  const hoje = estado.hoje;
  const referencia = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(hoje);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Principal"
        title="Relatório"
        description={`Mapa de ações pra ${referencia} — o que priorizar essa semana e esse mês, mesmo que hoje pareça fora de alcance.`}
      />

      <div className="glass-card rounded-2xl p-5">
        <p className="text-sm font-medium text-foreground">Ação prioritária</p>
        <p className="mt-2 text-sm text-muted-foreground">{acaoPrioritaria}</p>
      </div>

      <div className="glass-card flex items-center gap-2 rounded-2xl p-5">
        <ScoreGauge pontos={score.pontos} faixa={score.faixa} />
        <div>
          <p className="text-sm font-medium text-foreground">Score de saúde financeira</p>
          <p className="text-xs text-muted-foreground">
            Detalhamento completo e simuladores em{" "}
            <Link href="/consultor" className="text-gold underline underline-offset-4">
              Consultor
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <p className="text-sm font-medium text-foreground">Progresso das metas</p>
        {metasComProgresso.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma meta ativa.{" "}
            <Link href="/metas/novo" className="text-gold underline underline-offset-4">
              Criar uma meta
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {metasComProgresso.map(({ meta, progresso }) => (
              <li key={meta.id} className="text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-foreground">{meta.nome}</span>
                  <span className="num text-xs text-muted-foreground">
                    faltam {formatarBRL(progresso.valorFaltanteCentavos)}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">
                  {progresso.temDadosDeAlocacao
                    ? progresso.ritmoNecessarioCentavos != null
                      ? `Ritmo necessário: ${formatarBRL(progresso.ritmoNecessarioCentavos)}/mês pelos próximos ${progresso.mesesRestantes.toFixed(1)} meses.`
                      : "Data-alvo já vencida — vale reavaliar o prazo."
                    : "Ainda sem lançamentos vinculados — importe o extrato e classifique como alocação dessa meta pra rastrear de verdade."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <p className="text-sm font-medium text-foreground">Maiores ofensores do mês</p>
        {ofensores.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sem despesas classificadas este mês ainda.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {ofensores.slice(0, 3).map((o) => (
              <li key={o.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{o.nome}</span>
                <span className="num font-medium text-debt">{formatarBRL(o.totalCentavos)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/ofensores" className="mt-3 inline-block text-xs text-gold underline underline-offset-4">
          ver detalhamento completo
        </Link>
      </div>

      {maioresVariacoes.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <p className="text-sm font-medium text-foreground">O que mudou</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Maior variação de gasto por categoria, comparando os dois últimos meses com dado real.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {maioresVariacoes.map((v) => (
              <li key={v.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{v.nome}</span>
                <span className={`num ${v.variacaoCentavos >= 0 ? "text-debt" : "text-liquidity"}`}>
                  {v.variacaoCentavos >= 0 ? "+" : ""}
                  {formatarBRL(v.variacaoCentavos)}
                  {v.variacaoPct != null && ` (${v.variacaoPct >= 0 ? "+" : ""}${v.variacaoPct.toFixed(0)}%)`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-card rounded-2xl p-5">
        <p className="text-sm font-medium text-foreground">Qualidade dos dados</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Otimização, Consultor e a trilha do Mapa só refletem pagamentos reais quando a transação está vinculada e o
          saldo do passivo é atualizado a partir disso — sem isso, eles olham pro que foi digitado no cadastro.
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          <li className="flex items-center justify-between">
            <span className="text-foreground">Transações sem categoria</span>
            <span className="num text-gold">
              {qualidadeDados.semCategoria} de {qualidadeDados.totalTransacoes}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-foreground">Transações sem vínculo a passivo/ativo/meta</span>
            <span className="num text-gold">
              {qualidadeDados.semVinculo} de {qualidadeDados.totalTransacoes}
            </span>
          </li>
        </ul>
        {(qualidadeDados.semCategoria > 0 || qualidadeDados.semVinculo > 0) && (
          <div className="mt-2 flex gap-3 text-xs">
            {qualidadeDados.semCategoria > 0 && (
              <Link href="/transacoes?semCategoria=1" className="text-gold underline underline-offset-4">
                resolver sem categoria
              </Link>
            )}
            {qualidadeDados.semVinculo > 0 && (
              <Link href="/transacoes?semVinculo=1" className="text-gold underline underline-offset-4">
                resolver sem vínculo
              </Link>
            )}
          </div>
        )}

        {qualidadeDados.passivosComReconciliacaoPendente.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-debt">
              Pagamento real pendente de confirmação
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Esses passivos já têm uma transação vinculada que muda o saldo, mas ninguém confirmou isso na tela do
              passivo ainda — Otimização, Consultor e o patrimônio líquido do Mapa continuam usando o saldo antigo.
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {qualidadeDados.passivosComReconciliacaoPendente.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <Link href={`/passivos/${p.id}`} className="text-foreground underline underline-offset-4">
                    {p.nome}
                  </Link>
                  <span className="text-xs text-debt">
                    {p.saldoDocumentadoCentavos != null ? formatarBRL(p.saldoDocumentadoCentavos) : "—"} → sugerido{" "}
                    {formatarBRL(p.saldoSugeridoCentavos)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {qualidadeDados.passivosDesatualizados.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Passivos desatualizados há muito tempo
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {qualidadeDados.passivosDesatualizados.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <Link href={`/passivos/${p.id}`} className="text-foreground underline underline-offset-4">
                    {p.nome}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {p.nuncaAtualizado ? "nunca atualizado" : `${p.diasSemAtualizacao} dias sem atualizar`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {qualidadeDados.ativosFinanciadosDesatualizados.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ativos financiados por dívida com sinal desatualizado
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              O saldo desse ativo veio de um empréstimo — se a dívida já foi quitada ou está com saldo desatualizado,
              o patrimônio líquido pode estar contando esse dinheiro como novo sem o desconto certo do outro lado.
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {qualidadeDados.ativosFinanciadosDesatualizados.map((a) => (
                <li key={a.ativoId} className="flex items-center justify-between text-sm">
                  <Link href={`/ativos/${a.ativoId}`} className="text-foreground underline underline-offset-4">
                    {a.ativoNome}
                  </Link>
                  <span className="text-xs text-debt">
                    {a.motivo === "passivo_quitado"
                      ? `${a.passivoNome} já foi quitado — conferir vínculo`
                      : `${a.passivoNome} com saldo desatualizado`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {qualidadeDados.passivosSemMovimentoRecente.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Passivos sem nenhuma transação vinculada nos últimos 12 meses
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Esses credores nunca aparecem em &ldquo;Maiores ofensores&rdquo; (nem por categoria, nem por credor)
              porque não há nenhum pagamento vinculado a eles no período — provavelmente um pagamento real está
              caindo em &ldquo;sem vínculo&rdquo; em vez de ser ligado ao credor certo.
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {qualidadeDados.passivosSemMovimentoRecente.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <Link href={`/passivos/${p.id}`} className="text-foreground underline underline-offset-4">
                    {p.nome}
                  </Link>
                  <span className="text-xs text-gold">
                    {p.custoMensalCentavos ? `${formatarBRL(p.custoMensalCentavos)}/mês esperado` : "sem movimento"}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/transacoes?semVinculo=1" className="mt-2 inline-block text-xs text-gold underline underline-offset-4">
              resolver sem vínculo
            </Link>
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <p className="text-sm font-medium text-foreground">Checklist da semana/mês</p>

        {estado.proximasAcoes.filter((a) => a.tipo === "tarefa").length === 0 &&
        estado.alertas.length === 0 &&
        fatoresPendentes.length === 0 ? (
          <p className="mt-2 text-sm text-liquidity">Tudo em dia — nenhuma pendência encontrada agora.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {estado.proximasAcoes.filter((a) => a.tipo === "tarefa").length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ações imediatas
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {estado.proximasAcoes
                    .filter((a) => a.tipo === "tarefa")
                    .map((a) => (
                      <li key={a.titulo} className="text-sm text-foreground">
                        ☐ {a.titulo}
                        {a.href && (
                          <Link href={a.href} className="ml-1 text-xs text-gold underline underline-offset-4">
                            resolver
                          </Link>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {estado.alertas.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Alertas de risco
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {estado.alertas.map((a) => (
                    <li key={a.titulo} className="text-sm text-foreground">
                      ☐ {a.titulo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fatoresPendentes.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pra fechar o score
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {fatoresPendentes.map((f) => (
                    <li key={f.nome} className="text-sm text-foreground">
                      ☐ {f.nome} ({f.pontosAtuais}/{f.pontosMaximos})
                      {f.href && (
                        <Link href={f.href} className="ml-1 text-xs text-gold underline underline-offset-4">
                          resolver
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
