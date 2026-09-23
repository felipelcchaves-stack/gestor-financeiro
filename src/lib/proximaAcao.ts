// Motor de "o que fazer agora" — responde diretamente à pergunta que mais
// trava um usuário não-técnico: "eu deveria estar mexendo em quê agora?".
// Regras determinísticas, em português simples, sem jargão técnico nos
// textos exibidos. Prioridade: dado estrutural faltando > configuração >
// dado de acompanhamento faltando > tudo em dia.

import type { Configuracao, Meta, Passivo } from "@/generated/prisma";

export type Acao = {
  titulo: string;
  descricao: string;
  href: string | null;
  tipo: "tarefa" | "positivo";
};

const DIAS_ANTES_DE_COBRAR_PRIMEIRO_REGISTRO = 45;
const MESES_SEM_REGISTRO_PARA_LEMBRAR = 2;

function mesesEntreReferencias(mesReferencia: string, hoje: Date): number {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  return (hoje.getFullYear() - ano) * 12 + (hoje.getMonth() + 1 - mes);
}

export function calcularProximasAcoes(input: {
  passivos: Passivo[];
  metas: (Meta & { alocacoes: unknown[]; passivosAlvo: { passivo: { _count: { transacoes: number } } }[] })[];
  contas: { saldoAtualizadoEm: Date | null }[];
  configuracao: Configuracao | null;
  snapshots?: { mesReferencia: string }[];
  hoje?: Date;
}): Acao[] {
  const { passivos, metas, contas, configuracao, snapshots = [], hoje = new Date() } = input;
  const acoes: Acao[] = [];

  const passivosAtivos = passivos.filter((p) => p.status === "ATIVO");

  if (passivosAtivos.length === 0) {
    acoes.push({
      titulo: "Cadastre sua primeira dívida",
      descricao:
        "Toda dívida que você tem — cartão, empréstimo, financiamento, até dívida informal. É daqui que sai o cálculo da sua rota de saída. Se preferir, use o assistente pra cadastrar tudo de uma vez.",
      href: "/comecar",
      tipo: "tarefa",
    });
  }

  const semValorDocumentado = passivosAtivos.filter((p) => p.valorQuitacaoCentavos == null);
  if (semValorDocumentado.length > 0) {
    const nomes = semValorDocumentado.map((p) => p.nome).join(", ");
    acoes.push({
      titulo:
        semValorDocumentado.length === 1
          ? `Confirme o saldo de ${nomes}`
          : `Confirme o saldo de ${semValorDocumentado.length} dívidas`,
      descricao: `Sem o valor total (${nomes}), a rota de saída fica incompleta — o sistema não consegue calcular quando essas dívidas somem.`,
      href: `/passivos/${semValorDocumentado[0].id}/editar`,
      tipo: "tarefa",
    });
  }

  const nenhumaContaAtualizada = contas.every((c) => c.saldoAtualizadoEm == null);
  if (nenhumaContaAtualizada) {
    acoes.push({
      titulo: "Importe seu extrato mais recente",
      descricao:
        "Sem um extrato importado, o sistema não sabe seu saldo real nem consegue rastrear o progresso das suas metas automaticamente.",
      href: "/importar/extrato",
      tipo: "tarefa",
    });
  }

  const metasAtivas = metas.filter((m) => m.status === "ATIVA");
  if (metasAtivas.length === 0) {
    acoes.push({
      titulo: "Defina sua primeira meta de quitação",
      descricao:
        "Um objetivo do tipo 'zerar tal dívida até tal data'. O sistema te diz se o ritmo atual é suficiente pra chegar lá.",
      href: "/metas/novo",
      tipo: "tarefa",
    });
  }

  if (configuracao?.aporteMensalExtraCentavos == null) {
    acoes.push({
      titulo: "Diga quanto você consegue direcionar por mês",
      descricao:
        "Esse número — além dos pagamentos mínimos que já saem — é o que destrava a trilha completa e as datas estimadas de quitação.",
      href: null,
      tipo: "tarefa",
    });
  }

  // "Tem lançamento vinculado" pra uma meta de dívida não passa por
  // AlocacaoMeta (esse vínculo nunca é usado nesse caso) — o real é
  // transação ligada ao passivo-alvo, a mesma reconciliação usada em
  // /passivos/[id]. Sem checar isso, esse aviso nunca para de disparar
  // pra meta de dívida, mesmo com progresso real (visto com dado real:
  // "Zerar Agiota" tinha 6 transações no passivo e 0 AlocacaoMeta).
  const temProgressoReal = (m: (typeof metasAtivas)[number]) =>
    m.alocacoes.length > 0 || m.passivosAlvo.some((pa) => pa.passivo._count.transacoes > 0);

  const metaSemAlocacao = metasAtivas.find((m) => !temProgressoReal(m));
  if (metaSemAlocacao) {
    acoes.push({
      titulo: `A meta "${metaSemAlocacao.nome}" ainda não tem nenhum lançamento vinculado`,
      descricao:
        "Importe o extrato do mês e vincule os lançamentos a essa meta pra começar a rastrear o progresso de verdade.",
      href: "/importar/extrato",
      tipo: "tarefa",
    });
  }

  if (snapshots.length === 0) {
    const passivoMaisAntigo = passivosAtivos.reduce<Date | null>((mais, p) => {
      const criado = new Date(p.createdAt);
      return !mais || criado < mais ? criado : mais;
    }, null);
    const diasDesdeOMaisAntigo = passivoMaisAntigo
      ? (hoje.getTime() - passivoMaisAntigo.getTime()) / (1000 * 60 * 60 * 24)
      : 0;

    if (diasDesdeOMaisAntigo >= DIAS_ANTES_DE_COBRAR_PRIMEIRO_REGISTRO) {
      acoes.push({
        titulo: "Você ainda não registrou seu patrimônio nenhuma vez",
        descricao: "Registrar o patrimônio deste mês (no Mapa) é o que liga o termômetro de saindo do buraco vs. voltando pra ele.",
        href: "/",
        tipo: "tarefa",
      });
    }
  } else {
    const ultimoRegistro = [...snapshots].sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia))[0];
    if (mesesEntreReferencias(ultimoRegistro.mesReferencia, hoje) >= MESES_SEM_REGISTRO_PARA_LEMBRAR) {
      acoes.push({
        titulo: "Faz tempo que você não registra seu patrimônio",
        descricao: "Já faz 2 meses ou mais desde o último registro — bora atualizar o termômetro no Mapa?",
        href: "/",
        tipo: "tarefa",
      });
    }
  }

  if (acoes.length === 0) {
    acoes.push({
      titulo: "Seus dados estão em dia",
      descricao: "A rota abaixo já reflete sua situação mais recente.",
      href: null,
      tipo: "positivo",
    });
  }

  return acoes.slice(0, 3);
}
