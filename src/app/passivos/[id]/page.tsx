import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatarBRL, centavosParaReais } from "@/lib/money";
import {
  marcarPassivoQuitado,
  reabrirPassivo,
  registrarCicloFatura,
  atualizarPassivo,
  confirmarPagamentoPassivo,
  aceitarEstimativaCronograma,
} from "../actions";
import { calcularReconciliacaoPassivo } from "@/lib/passivoReconciliacao";
import { proximaParcela, calcularEstimativaCronograma } from "@/lib/cronogramaAmortizacao";
import { calcularTrajetoriaRealPassivo } from "@/lib/ofensores";
import { TrajetoriaCredorChart } from "@/app/ofensores/TrajetoriaCredorChart";
import { Button } from "@/components/ui/button";

const ESTRUTURA_LABEL: Record<string, string> = {
  AMORTIZA_NORMAL: "Amortiza normalmente",
  SO_JUROS_SEM_AMORTIZACAO: "Só juros, sem amortização",
  SEM_JUROS: "Sem juros",
};

export default async function PassivoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [passivo, transacoesVinculadas, reconciliacao, cronograma, transacoesCandidatas, trajetoria] = await Promise.all([
    prisma.passivo.findUnique({
      where: { id },
      include: {
        historico: { orderBy: { registradoEm: "desc" } },
        ciclosFatura: { orderBy: { referencia: "desc" } },
        ativosVinculados: { include: { ativo: true } },
      },
    }),
    prisma.transacao.findMany({ where: { passivoId: id }, orderBy: { data: "desc" } }),
    calcularReconciliacaoPassivo(id),
    prisma.passivoParcelaCronograma.findMany({ where: { passivoId: id }, orderBy: { numeroParcela: "asc" } }),
    // Inclui tanto transação ainda sem vínculo nenhum quanto uma já
    // vinculada A ESTE MESMO passivo — um pagamento pode ter sido
    // vinculado manualmente em /transacoes antes de existir este fluxo
    // (ex: Sem Parar/Afinz, Magazine Luiza/Luizacred), e nesse caso ele
    // nunca apareceria numa busca só por passivoId: null.
    prisma.transacao.findMany({
      where: { tipo: "DESPESA", ehTransferencia: false, OR: [{ passivoId: null }, { passivoId: id }] },
      orderBy: { data: "desc" },
      take: 40,
    }),
    calcularTrajetoriaRealPassivo(id),
  ]);
  if (!passivo) notFound();

  const parcelaSeguinte = cronograma.length > 0 ? proximaParcela(cronograma, passivo.parcelaAtual ?? 0) : null;
  const estimativa =
    cronograma.length > 0
      ? calcularEstimativaCronograma(cronograma, passivo.parcelaAtual ?? 0, passivo.valorQuitacaoCentavos ?? 0, new Date())
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{passivo.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {passivo.tipo} · {ESTRUTURA_LABEL[passivo.estrutura]} · {passivo.status}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/passivos/${id}/editar`}
            className="rounded border border-input px-3 py-1.5 text-sm"
          >
            Editar
          </Link>
          {passivo.status === "ATIVO" ? (
            <form action={marcarPassivoQuitado.bind(null, id)}>
              <button type="submit" className="rounded border border-input px-3 py-1.5 text-sm">
                Marcar quitado
              </button>
            </form>
          ) : (
            <form action={reabrirPassivo.bind(null, id)}>
              <button type="submit" className="rounded border border-input px-3 py-1.5 text-sm">
                Reabrir
              </button>
            </form>
          )}
        </div>
      </div>

      {passivo.documentoFonteId && (
        <a
          href={`/api/documentos/${passivo.documentoFonteId}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline"
        >
          ver documento-fonte
        </a>
      )}

      <dl className="grid grid-cols-2 gap-4 glass-card rounded-2xl p-5 sm:grid-cols-4">
        <Metric
          label="Valor de quitação"
          value={
            passivo.valorQuitacaoCentavos != null
              ? formatarBRL(passivo.valorQuitacaoCentavos)
              : "não documentado"
          }
        />
        <Metric
          label="Custo mensal"
          value={
            passivo.custoMensalCentavos != null
              ? formatarBRL(passivo.custoMensalCentavos)
              : passivo.custoMensalVariavel
                ? "variável por ciclo"
                : "—"
          }
        />
        <Metric label="Taxa de juros" value={passivo.taxaJurosPct != null ? `${passivo.taxaJurosPct}% a.m.` : "—"} />
        <Metric
          label="Progresso"
          value={
            passivo.parcelaAtual != null && passivo.totalParcelas != null
              ? `${passivo.parcelaAtual}/${passivo.totalParcelas}`
              : "—"
          }
        />
      </dl>

      <section className="glass-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Evolução</h2>
        {trajetoria.length > 1 ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              Total pago desde {new Date(trajetoria[0].data).toLocaleDateString("pt-BR")}:{" "}
              <span className="font-medium text-liquidity">
                {formatarBRL(Math.max(0, trajetoria[0].valorCentavos - trajetoria[trajetoria.length - 1].valorCentavos))}
              </span>
            </p>
            <div className="mt-3">
              <TrajetoriaCredorChart nome={passivo.nome} real={trajetoria} projetado={null} mesQuitacao={null} />
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Ainda não há histórico confirmado no sistema pra desenhar sua evolução — o saldo documentado nunca
            mudou desde o cadastro. Se você já pagou algo dessa dívida, confirme um pagamento no bloco
            &quot;Quitar / Amortizar&quot; abaixo (ou espere o alerta de reconciliação, se houver) pra começar a
            registrar.
          </p>
        )}
      </section>

      {passivo.observacao && (
        <p className="rounded-lg border border-gold/20 bg-gold/[0.06] p-3 text-sm text-gold">
          {passivo.observacao}
        </p>
      )}

      {passivo.status === "ATIVO" && passivo.valorQuitacaoCentavos != null && (
        <section className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground">Quitar / Amortizar</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha uma transação de saída já importada — nova (sem vínculo) ou já vinculada a este passivo
            aguardando confirmação — nunca cria uma transação do zero. Se o valor pago cobrir o saldo inteiro,
            quita; senão, e havendo cronograma real do contrato, abate exatamente o principal da próxima parcela
            documentada (nunca o valor pago inteiro, que incluiria juro).
          </p>
          {parcelaSeguinte && (
            <p className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Próxima parcela do contrato: <span className="font-medium text-foreground">{parcelaSeguinte.numeroParcela}</span>{" "}
              (venc. {new Date(parcelaSeguinte.vencimento).toLocaleDateString("pt-BR")}) — dela,{" "}
              {formatarBRL(parcelaSeguinte.principalCentavos)} seriam principal e{" "}
              {formatarBRL(parcelaSeguinte.jurosCentavos)} seriam juro.
            </p>
          )}
          {transacoesCandidatas.length === 0 ? (
            <p className="mt-3 text-sm text-gold">
              Nenhuma transação de saída sem vínculo encontrada. Importe/classifique o extrato primeiro em{" "}
              <Link href="/transacoes" className="underline underline-offset-4">
                Transações
              </Link>
              .
            </p>
          ) : (
            <form action={confirmarPagamentoPassivo.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Transação de pagamento</label>
                <select
                  name="transacaoId"
                  required
                  className="w-80 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="">selecione…</option>
                  {transacoesCandidatas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {new Date(t.data).toLocaleDateString("pt-BR")} — {t.descricao} — {formatarBRL(t.valorCentavos)}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit">Confirmar pagamento</Button>
            </form>
          )}
        </section>
      )}

      {estimativa && (
        <section className="rounded-lg border border-gold/30 bg-gold/[0.06] p-4">
          <p className="text-sm text-gold">
            Pelas datas do contrato, você já deveria estar na parcela{" "}
            <span className="font-medium">{estimativa.novaParcelaAtual}</span> — dado real do banco (soma do
            principal das parcelas {estimativa.parcelasPendentes.map((p) => p.numeroParcela).join(", ")}, com
            vencimento até {new Date(estimativa.parcelasPendentes[estimativa.parcelasPendentes.length - 1].vencimento).toLocaleDateString("pt-BR")}),
            mas isso <strong>não foi confirmado</strong> por nenhum pagamento real nem por um contrato atualizado.
            Saldo estimado: {formatarBRL(estimativa.saldoEstimadoCentavos)}.
          </p>
          <form action={aceitarEstimativaCronograma.bind(null, id)} className="mt-3">
            <Button type="submit" variant="outline">
              Aceitar estimativa como saldo documentado
            </Button>
          </form>
        </section>
      )}

      {passivo.ativosVinculados.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground">Ativos vinculados (garantia)</h2>
          <ul className="mt-2 text-sm text-muted-foreground">
            {passivo.ativosVinculados.map((v) => (
              <li key={v.id}>
                {v.ativo.nome} — {v.tipoVinculo}
              </li>
            ))}
          </ul>
        </section>
      )}

      {passivo.custoMensalVariavel && (
        <section>
          <h2 className="text-sm font-semibold text-foreground">Ciclos de fatura</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Este passivo não tem custo mensal fixo — lance o valor da fatura a cada ciclo.
          </p>

          <form
            action={registrarCicloFatura.bind(null, id)}
            className="mt-3 flex flex-wrap items-end gap-3 glass-card rounded-2xl p-4"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Referência</label>
              <input
                name="referencia"
                placeholder="2026-09"
                required
                className="w-28 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Valor da fatura (R$)</label>
              <input
                name="valor"
                type="text"
                inputMode="decimal"
                required
                className="w-32 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Mínimo (R$)</label>
              <input
                name="valorMinimo"
                type="text"
                inputMode="decimal"
                className="w-28 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Vencimento</label>
              <input name="vencimento" type="date" className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground" />
            </div>
            <Button type="submit">Lançar</Button>
          </form>

          {passivo.ciclosFatura.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">Referência</th>
                  <th className="py-1 font-medium text-right">Valor</th>
                  <th className="py-1 font-medium text-right">Mínimo</th>
                  <th className="py-1 font-medium">Vencimento</th>
                  <th className="py-1 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {passivo.ciclosFatura.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5">{c.referencia}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatarBRL(c.valorCentavos)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {c.valorMinimoCentavos != null ? formatarBRL(c.valorMinimoCentavos) : "—"}
                    </td>
                    <td className="py-1.5">
                      {c.vencimento ? new Date(c.vencimento).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="py-1.5">
                      {c.documentoId && (
                        <a
                          href={`/api/documentos/${c.documentoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground/70 underline"
                        >
                          documento
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-foreground">Movimentações vinculadas</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Transações do extrato/fatura vinculadas a este passivo — pagamento reduz o saldo, desembolso (empréstimo
          recebido) aumenta. É o que permite conferir se o saldo documentado ainda bate com a realidade.
        </p>

        {transacoesVinculadas.length === 0 ? (
          <p className="mt-2 text-sm text-gold">
            Nenhuma transação vinculada ainda — o saldo acima não reflete nenhuma movimentação real, só o que foi
            digitado manualmente. Vincule lançamentos do extrato a este passivo em{" "}
            <Link href="/transacoes" className="underline underline-offset-4">
              Transações
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1">
            {transacoesVinculadas.map((t) => {
              // ENTRADA vinculada a um passivo é desembolso de empréstimo, não
              // receita — o dinheiro entrou de verdade, mas é dívida nova, não
              // sobra. Nunca usa o verde de "recebi dinheiro" pra não passar
              // a impressão errada de que sobrou saldo no mês.
              const desembolso = t.tipo === "ENTRADA";
              return (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {new Date(t.data).toLocaleDateString("pt-BR")} — {t.descricao}
                    {desembolso && <span className="ml-1.5 text-[10px] text-debt">empréstimo recebido</span>}
                  </span>
                  <span className="num text-debt">
                    {desembolso ? "+" : "-"}
                    {formatarBRL(t.valorCentavos)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {reconciliacao && reconciliacao.pagamentoEhSoJuroSemAbaterPrincipal && (
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Desde {new Date(reconciliacao.dataUltimaAtualizacao).toLocaleDateString("pt-BR")}, você tem{" "}
              {formatarBRL(reconciliacao.pagoDesdeUltimaAtualizacaoCentavos)} em pagamentos vinculados — mas essa
              dívida é só juros, sem amortização: esse valor cobre o juro do período, não abate o principal. O saldo
              só reduz quando o valor pago atingir o total de {formatarBRL(reconciliacao.saldoAtualDocumentadoCentavos ?? 0)}
              de uma vez.
            </p>
          </div>
        )}

        {reconciliacao && reconciliacao.saldoSugeridoCentavos != null && (
          <div className="mt-3 rounded-lg border border-gold/30 bg-gold/[0.06] p-4">
            <p className="text-sm text-gold">
              Desde {new Date(reconciliacao.dataUltimaAtualizacao).toLocaleDateString("pt-BR")} (última vez que o
              saldo foi confirmado), você tem{" "}
              {reconciliacao.pagoDesdeUltimaAtualizacaoCentavos > 0 &&
                `${formatarBRL(reconciliacao.pagoDesdeUltimaAtualizacaoCentavos)} em pagamentos`}
              {reconciliacao.pagoDesdeUltimaAtualizacaoCentavos > 0 && reconciliacao.desembolsadoDesdeUltimaAtualizacaoCentavos > 0 && " e "}
              {reconciliacao.desembolsadoDesdeUltimaAtualizacaoCentavos > 0 &&
                `${formatarBRL(reconciliacao.desembolsadoDesdeUltimaAtualizacaoCentavos)} em novos desembolsos`}{" "}
              vinculados, mas o saldo documentado não mudou. Pelo que já entrou e saiu de verdade, o saldo hoje seria
              aproximadamente {formatarBRL(reconciliacao.saldoSugeridoCentavos)}.
            </p>
            <form action={atualizarPassivo.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="nome" value={passivo.nome} />
              <input type="hidden" name="tipo" value={passivo.tipo} />
              <input type="hidden" name="estrutura" value={passivo.estrutura} />
              <input type="hidden" name="custoMensal" value={passivo.custoMensalCentavos != null ? centavosParaReais(passivo.custoMensalCentavos) : ""} />
              {passivo.custoMensalVariavel && <input type="hidden" name="custoMensalVariavel" value="on" />}
              <input type="hidden" name="taxaJurosPct" value={passivo.taxaJurosPct != null ? String(passivo.taxaJurosPct) : ""} />
              <input type="hidden" name="parcelaAtual" value={passivo.parcelaAtual != null ? String(passivo.parcelaAtual) : ""} />
              <input type="hidden" name="totalParcelas" value={passivo.totalParcelas != null ? String(passivo.totalParcelas) : ""} />
              <input type="hidden" name="observacao" value={passivo.observacao ?? ""} />
              <input type="hidden" name="motivo" value="Atualizado a partir de pagamentos vinculados no extrato/fatura" />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Novo saldo de quitação (R$)</label>
                <input
                  name="valorQuitacao"
                  type="text"
                  inputMode="decimal"
                  defaultValue={centavosParaReais(reconciliacao.saldoSugeridoCentavos)}
                  className="w-40 rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
                />
              </div>
              <Button type="submit">Atualizar saldo</Button>
            </form>
          </div>
        )}
      </section>

      {passivo.historico.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground">Histórico de mudanças</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {passivo.historico.map((h) => (
              <li key={h.id} className="rounded glass-card p-3 text-sm">
                <div className="text-foreground">
                  <span className="font-medium">{h.campo}</span>: {h.valorAnterior ?? "não documentado"} →{" "}
                  {h.valorNovo}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground/70">
                  {new Date(h.registradoEm).toLocaleString("pt-BR")}
                  {h.motivo && ` · ${h.motivo}`}
                  {h.documentoId && (
                    <>
                      {" · "}
                      <a href={`/api/documentos/${h.documentoId}`} target="_blank" rel="noreferrer" className="underline">
                        documento
                      </a>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
