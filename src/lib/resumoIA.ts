// Monta um texto limpo em markdown com a posição atual — pra colar numa
// conversa com uma IA (ou trazer numa sessão de código) e pedir uma
// segunda opinião. Nada é enviado automaticamente pra fora da máquina: o
// usuário decide se e onde cola esse texto.

import { formatarBRL, mesAnoDaquiA } from "@/lib/money";
import { calcularProgressoMeta } from "@/lib/metrics";
import type { EstadoAtual } from "@/lib/estadoAtual";

export function gerarResumoMarkdown(estado: EstadoAtual): string {
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
