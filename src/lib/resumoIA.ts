// Monta um texto limpo em markdown com a posição atual — pra colar numa
// conversa com uma IA (ou trazer numa sessão de código) e pedir uma
// segunda opinião. Nada é enviado automaticamente pra fora da máquina: o
// usuário decide se e onde cola esse texto.

import { formatarBRL, mesAnoDaquiA } from "@/lib/money";
import { calcularProgressoMeta } from "@/lib/metrics";
import type { EstadoAtual } from "@/lib/estadoAtual";
import type { QualidadeDados } from "@/lib/qualidadeDados";
import type { MovimentacaoDoMes, PontoSaldo } from "@/lib/ofensores";

export function gerarResumoMarkdown(
  estado: EstadoAtual,
  qualidadeDados: QualidadeDados,
  movimentacaoDoMes: MovimentacaoDoMes,
  trajetoriasPorPassivo: Map<string, PontoSaldo[]>
): string {
  const linhas: string[] = [];

  linhas.push(`# Resumo financeiro — ${estado.hoje.toLocaleDateString("pt-BR")}`);
  linhas.push("");
  linhas.push(`- Passivo total (documentado): ${formatarBRL(estado.passivoTotal)}`);
  linhas.push(`- Ativos: ${formatarBRL(estado.ativoTotal)}`);
  linhas.push(`- Patrimônio líquido: ${formatarBRL(estado.patrimonio)}`);
  linhas.push(`- Aporte mensal extra configurado: ${estado.configuracao?.aporteMensalExtraCentavos != null ? formatarBRL(estado.configuracao.aporteMensalExtraCentavos) : "não configurado"}`);
  linhas.push(
    `- Margem livre mensal: ${formatarBRL(estado.margemLivre.margemLivreCentavos)} (entradas recorrentes − despesas recorrentes − parcelas dos passivos − aporte de quitação)`
  );
  linhas.push("");

  linhas.push(`## Movimentação real deste mês (extrato, não configuração)`);
  linhas.push(`- Entradas confirmadas no extrato: ${formatarBRL(movimentacaoDoMes.entradasCentavos)}`);
  linhas.push(`- Despesas confirmadas no extrato: ${formatarBRL(movimentacaoDoMes.despesasTotalCentavos)}`);
  if (movimentacaoDoMes.despesasPorCategoria.length > 0) {
    linhas.push("- Por categoria:");
    for (const c of movimentacaoDoMes.despesasPorCategoria) {
      linhas.push(`  - ${c.nome}: ${formatarBRL(c.totalCentavos)}`);
    }
  }
  linhas.push("");

  linhas.push("## Evolução por dívida (o que já foi pago de verdade)");
  if (estado.passivosAtivos.length === 0) {
    linhas.push("Nenhum passivo ativo cadastrado.");
  } else {
    for (const p of estado.passivosAtivos) {
      const trajetoria = trajetoriasPorPassivo.get(p.id) ?? [];
      if (trajetoria.length > 1) {
        const inicio = trajetoria[0];
        const atual = trajetoria[trajetoria.length - 1];
        const pago = Math.max(0, inicio.valorCentavos - atual.valorCentavos);
        linhas.push(
          `- ${p.nome}: começou em ${formatarBRL(inicio.valorCentavos)} (${new Date(inicio.data).toLocaleDateString("pt-BR")}), hoje ${formatarBRL(atual.valorCentavos)} — já pago ${formatarBRL(pago)}.`
        );
      } else {
        linhas.push(`- ${p.nome}: ainda sem histórico confirmado no sistema (nenhuma atualização de saldo registrada desde o cadastro).`);
      }
    }
  }
  linhas.push("");

  linhas.push("## O que estou pagando por dívida agora");
  if (estado.passivosAtivos.length === 0) {
    linhas.push("Nenhum passivo ativo cadastrado.");
  } else {
    for (const p of estado.passivosAtivos) {
      const parcela = p.parcelaAtual != null && p.totalParcelas != null ? ` (parcela ${p.parcelaAtual}/${p.totalParcelas})` : "";
      const custo = p.custoMensalCentavos != null ? formatarBRL(p.custoMensalCentavos) : "não documentado";
      linhas.push(`- ${p.nome}: ${custo}/mês${parcela}`);
    }
  }
  linhas.push("");

  linhas.push("## Qualidade dos dados (leia antes de confiar 100% nos números acima)");
  const semCadastro: string[] = [];
  if (qualidadeDados.semCategoria > 0) semCadastro.push(`${qualidadeDados.semCategoria} transação(ões) sem categoria`);
  if (qualidadeDados.semVinculo > 0) semCadastro.push(`${qualidadeDados.semVinculo} transação(ões) sem vínculo a um passivo/ativo/meta`);
  if (semCadastro.length > 0) linhas.push(`- ${semCadastro.join("; ")}.`);
  if (qualidadeDados.passivosComReconciliacaoPendente.length > 0) {
    linhas.push(
      `- Pagamento real já identificado no extrato mas ainda não confirmado no cadastro (saldo pode estar desatualizado): ${qualidadeDados.passivosComReconciliacaoPendente
        .map((p) => p.nome)
        .join(", ")}.`
    );
  }
  if (qualidadeDados.passivosDesatualizados.length > 0) {
    linhas.push(
      `- Sem confirmação de saldo há 60+ dias (ou nunca confirmado): ${qualidadeDados.passivosDesatualizados
        .map((p) => p.nome)
        .join(", ")}.`
    );
  }
  if (
    semCadastro.length === 0 &&
    qualidadeDados.passivosComReconciliacaoPendente.length === 0 &&
    qualidadeDados.passivosDesatualizados.length === 0
  ) {
    linhas.push("Nenhuma pendência de qualidade de dados no momento — os números acima refletem o cadastro em dia.");
  }
  linhas.push("");

  linhas.push(`## Sinal de rota: ${estado.sinal.titulo}`);
  linhas.push(estado.sinal.mensagem);
  linhas.push("");

  linhas.push("## O que ainda falta resolver");
  const pendencias = estado.proximasAcoes.filter((a) => a.tipo === "tarefa");
  if (pendencias.length === 0) {
    linhas.push("Nenhuma pendência estrutural no momento.");
  } else {
    for (const acao of pendencias) linhas.push(`- ${acao.titulo}: ${acao.descricao}`);
  }
  linhas.push("");

  linhas.push("## Rota de quitação recomendada (menor juro total)");
  if (estado.rota) {
    for (const id of estado.rota.resultado.ordemIds) {
      const passivo = estado.elegiveis.find((e) => e.id === id)!;
      const quitacao = estado.rota.resultado.quitacoes.find((q) => q.passivoId === id);
      linhas.push(
        `- ${passivo.nome}: ${formatarBRL(passivo.saldoCentavos)}${
          quitacao ? ` — projeção de quitação em ${mesAnoDaquiA(quitacao.mes)}` : " — não quita no período simulado"
        }`
      );
    }
    linhas.push(
      `- Tempo total até zerar todas: ${estado.rota.resultado.mesesTotais} meses · Juros total estimado no caminho: ${formatarBRL(estado.rota.resultado.jurosTotalCentavos)}`
    );
  } else {
    linhas.push("Ainda não calculada — falta configurar o aporte mensal extra.");
  }
  linhas.push("");

  linhas.push("## Metas ativas");
  if (estado.metasAtivas.length === 0) {
    linhas.push("Nenhuma meta ativa cadastrada.");
  } else {
    for (const meta of estado.metasAtivas) {
      const progresso = calcularProgressoMeta(
        meta,
        meta.passivosAlvo.map((mp) => mp.passivo),
        meta.alocacoes,
        estado.hoje
      );
      linhas.push(
        `- ${meta.nome}: falta ${formatarBRL(progresso.valorFaltanteCentavos)}, data-alvo ${new Date(
          meta.dataAlvo
        ).toLocaleDateString("pt-BR")}${
          progresso.ritmoNecessarioCentavos != null
            ? `, ritmo necessário ${formatarBRL(progresso.ritmoNecessarioCentavos)}/mês`
            : ""
        }`
      );
    }
  }
  linhas.push("");

  if (estado.alertas.length > 0) {
    linhas.push("## Alertas de risco");
    for (const alerta of estado.alertas) linhas.push(`- ${alerta.titulo}: ${alerta.mensagem}`);
    linhas.push("");
  }

  if (estado.snapshots.length > 0) {
    linhas.push("## Histórico de patrimônio líquido (por mês registrado)");
    for (const s of estado.snapshots) {
      linhas.push(`- ${s.mesReferencia}: ${formatarBRL(s.patrimonioLiquidoCentavos)}`);
    }
    linhas.push("");
  }

  linhas.push("---");
  linhas.push(
    "Pergunta pra IA: dado esse retrato, o caminho que estou seguindo faz sentido? Tem algo que eu deveria priorizar diferente, dado meu objetivo de sair das dívidas o quanto antes?"
  );

  return linhas.join("\n");
}
