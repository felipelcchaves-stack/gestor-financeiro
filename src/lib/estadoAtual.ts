// Carrega e computa tudo que o Mapa de Saída (e o gerador de resumo pra
// IA) precisam, num lugar só — evita recalcular a mesma coisa em telas
// diferentes.

import { prisma } from "@/lib/prisma";
import { somaPassivosConhecidos, somaAtivos, patrimonioLiquido } from "@/lib/metrics";
import {
  encontrarVitoriaRapida,
  escolherEstrategia,
  type EstrategiaId,
  type PassivoParaOtimizacao,
} from "@/lib/otimizacao";
import { calcularProximasAcoes, type Acao } from "@/lib/proximaAcao";
import { calcularSinal, type Sinal } from "@/lib/sinal";
import { calcularAlertas, DIAS_PASSIVO_RECENTE, type Alerta } from "@/lib/alertas";
import { calcularMargemLivre, type MargemLivre } from "@/lib/margemLivre";
import { StatusMeta } from "@/generated/prisma";
import type { AlocacaoMeta, Configuracao, Meta, Passivo, PatrimonioSnapshot } from "@/generated/prisma";

export type MetaAtiva = Meta & { passivosAlvo: { passivo: Passivo }[]; alocacoes: AlocacaoMeta[] };

export type EstadoAtual = {
  hoje: Date;
  passivosAtivos: Passivo[];
  passivosQuitados: Passivo[];
  passivoTotal: number;
  ativoTotal: number;
  patrimonio: number;
  elegiveis: PassivoParaOtimizacao[];
  metasAtivas: MetaAtiva[];
  configuracao: Configuracao | null;
  proximasAcoes: Acao[];
  sinal: Sinal;
  vitoriaRapida: PassivoParaOtimizacao | null;
  rota: ReturnType<typeof escolherEstrategia> | null;
  snapshots: PatrimonioSnapshot[];
  alertas: Alerta[];
  margemLivre: MargemLivre;
};

export async function carregarEstadoAtual(hoje: Date = new Date()): Promise<EstadoAtual> {
  const desdeRecente = new Date(hoje.getTime() - DIAS_PASSIVO_RECENTE * 24 * 60 * 60 * 1000);

  const [
    passivos,
    ativos,
    contas,
    metasAtivas,
    configuracao,
    snapshots,
    passivosComCiclos,
    passivosRecentesSemMeta,
    recorrencias,
  ] = await Promise.all([
    prisma.passivo.findMany(),
    prisma.ativo.findMany(),
    prisma.conta.findMany(),
    prisma.meta.findMany({
      where: { status: StatusMeta.ATIVA },
      include: { passivosAlvo: { include: { passivo: true } }, alocacoes: true },
    }),
    prisma.configuracao.findUnique({ where: { id: "singleton" } }),
    prisma.patrimonioSnapshot.findMany({ orderBy: { mesReferencia: "asc" } }),
    prisma.passivo.findMany({
      where: { custoMensalVariavel: true },
      select: { id: true, nome: true, ciclosFatura: { select: { referencia: true, valorCentavos: true } } },
    }),
    prisma.passivo.findMany({
      where: { status: "ATIVO", createdAt: { gte: desdeRecente }, metas: { none: {} } },
      select: { nome: true, createdAt: true },
    }),
    prisma.recorrenciaFinanceira.findMany({ where: { ativa: true } }),
  ]);

  const passivosAtivos = passivos.filter((p) => p.status === "ATIVO");
  // Exclui passivo "substituido" (reorganizado em outros registros, não
  // pago de verdade) — senão ele viraria uma vitória falsa na trilha de
  // saída, mostrando um saldo que nunca foi de fato quitado.
  const passivosQuitados = passivos.filter((p) => p.status === "QUITADO" && !p.substituido);
  const passivoTotal = somaPassivosConhecidos(passivosAtivos);
  const ativoTotal = somaAtivos(ativos);
  const patrimonio = patrimonioLiquido(ativos, passivosAtivos);

  const elegiveis: PassivoParaOtimizacao[] = passivosAtivos
    .filter((p) => p.valorQuitacaoCentavos != null)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      saldoCentavos: p.valorQuitacaoCentavos!,
      custoMensalCentavos: p.custoMensalCentavos ?? 0,
      estrutura: p.estrutura,
    }));

  const proximasAcoes = calcularProximasAcoes({
    passivos: passivosAtivos,
    metas: metasAtivas,
    contas,
    configuracao,
    snapshots,
    hoje,
  });
  const aporte = configuracao?.aporteMensalExtraCentavos ?? null;
  const margemLivre = calcularMargemLivre({ recorrencias, passivosAtivos, aporteMensalExtraCentavos: aporte });
  const sinal = calcularSinal({ metasAtivas, configuracao, proximasAcoes, snapshots, margemLivre, hoje });
  const vitoriaRapida = encontrarVitoriaRapida(elegiveis);

  const rota =
    aporte != null && elegiveis.length > 0
      ? escolherEstrategia(elegiveis, aporte, configuracao?.estrategiaEscolhida as EstrategiaId | null, configuracao?.splitHibridoPct)
      : null;

  const alertas = calcularAlertas({ contas, passivosComCiclos, passivosRecentesSemMeta, hoje });

  return {
    hoje,
    passivosAtivos,
    passivosQuitados,
    passivoTotal,
    ativoTotal,
    patrimonio,
    elegiveis,
    metasAtivas,
    configuracao,
    proximasAcoes,
    sinal,
    vitoriaRapida,
    rota,
    snapshots,
    alertas,
    margemLivre,
  };
}
