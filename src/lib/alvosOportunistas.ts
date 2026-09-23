// Alvos "fora da fila" pro cofre de dívida (seção livre, insight do
// Felipe): a rota de menor juro (src/lib/rateio.ts, alvoSugerido) só
// aponta UM alvo — o próximo por ordem de juro, hoje o Agiota. Mas o
// saldo do cofre pode já cobrir integralmente uma dívida bem menor que
// não é a próxima da fila (um consignado, por exemplo) — quitá-la
// abre mão de um pouco de otimalidade de juro, mas libera a parcela
// mensal (desconto de folha) e alivia o fluxo de caixa AGORA. Se esse
// valor liberado virar aporte extra, acelera o alvo principal também
// — é esse segundo efeito que faz valer a pena, não só "menos uma
// dívida".
//
// Nenhuma matemática nova: a "aceleração" reaproveita o mesmo motor de
// otimização já em produção (src/lib/otimizacao.ts), só rodado de novo
// com um cenário hipotético (esse passivo já pago, aporte maior).

import type { EstadoAtual } from "@/lib/estadoAtual";
import { escolherEstrategia, type EstrategiaId } from "@/lib/otimizacao";

export type AlvoOportunista = {
  passivoId: string;
  nome: string;
  saldoCentavos: number;
  custoMensalCentavos: number;
  jaQuitavel: boolean;
  faltaParaQuitarCentavos: number;
  // Mês em que a ROTA REAL (não a hipotética) chegaria a quitar esse
  // alvo, se houver — mesmo campo que já alimenta a data-alvo
  // sugerida no card do alvoSugerido (src/app/cofre/page.tsx). Serve
  // só de sugestão de prazo pra criar a meta, nunca é a razão de
  // aparecer aqui (isso é decidido só pelo saldo do cofre).
  mesQuitacaoProjetado: number | null;
  // Null quando não dá pra calcular (sem rota/aporte configurado ainda,
  // ou quando quitar esse alvo não muda o mês do alvo principal) —
  // nunca um número inventado.
  aceleracao: {
    alvoPrincipalNome: string;
    mesAtual: number;
    mesComAceleracao: number;
    mesesAdiantados: number;
  } | null;
};

const LIMITE_ALVOS = 4;
// Rodar o motor de otimização de novo tem custo (permutação exaustiva
// até 7 passivos) — limita quantas simulações extras rodam por
// carregamento de página, calculando a aceleração só pros candidatos
// mais relevantes (já quitáveis, no topo da lista).
const LIMITE_SIMULACOES_ACELERACAO = 2;

export function calcularAlvosOportunistas(
  estado: EstadoAtual,
  saldoCofreCentavos: number,
  alvoPrincipalId: string | null
): AlvoOportunista[] {
  const candidatosBase = estado.elegiveis
    .filter((p) => p.id !== alvoPrincipalId && p.saldoCentavos > 0)
    .map((p) => ({
      passivoId: p.id,
      nome: p.nome,
      saldoCentavos: p.saldoCentavos,
      custoMensalCentavos: p.custoMensalCentavos,
      jaQuitavel: p.saldoCentavos <= saldoCofreCentavos,
      faltaParaQuitarCentavos: Math.max(0, p.saldoCentavos - saldoCofreCentavos),
      mesQuitacaoProjetado: estado.rota?.resultado.quitacoes.find((q) => q.passivoId === p.id)?.mes ?? null,
    }));

  const ordenados = candidatosBase
    .sort((a, b) => {
      // Já quitáveis primeiro; entre eles, o que libera mais alívio de
      // caixa por mês vem antes. Entre os que ainda faltam, o marco
      // mais próximo (falta menos) vem antes — "quando eu chegar lá".
      if (a.jaQuitavel !== b.jaQuitavel) return a.jaQuitavel ? -1 : 1;
      if (a.jaQuitavel) return b.custoMensalCentavos - a.custoMensalCentavos;
      return a.faltaParaQuitarCentavos - b.faltaParaQuitarCentavos;
    })
    .slice(0, LIMITE_ALVOS);

  const alvoPrincipal = alvoPrincipalId ? estado.elegiveis.find((p) => p.id === alvoPrincipalId) : undefined;
  const mesAtualAlvoPrincipal =
    alvoPrincipalId && estado.rota
      ? (estado.rota.resultado.quitacoes.find((q) => q.passivoId === alvoPrincipalId)?.mes ?? null)
      : null;

  let simulacoesFeitas = 0;

  return ordenados.map((candidato) => {
    let aceleracao: AlvoOportunista["aceleracao"] = null;

    if (
      candidato.jaQuitavel &&
      alvoPrincipal &&
      mesAtualAlvoPrincipal != null &&
      estado.configuracao?.aporteMensalExtraCentavos != null &&
      simulacoesFeitas < LIMITE_SIMULACOES_ACELERACAO
    ) {
      simulacoesFeitas += 1;

      const elegiveisSemCandidato = estado.elegiveis.filter((p) => p.id !== candidato.passivoId);
      const novoAporte = estado.configuracao.aporteMensalExtraCentavos + candidato.custoMensalCentavos;
      const { resultado } = escolherEstrategia(
        elegiveisSemCandidato,
        novoAporte,
        estado.configuracao.estrategiaEscolhida as EstrategiaId | null,
        estado.configuracao.splitHibridoPct
      );

      const novoMes = resultado.quitacoes.find((q) => q.passivoId === alvoPrincipalId)?.mes ?? null;
      if (novoMes != null && novoMes < mesAtualAlvoPrincipal) {
        aceleracao = {
          alvoPrincipalNome: alvoPrincipal.nome,
          mesAtual: mesAtualAlvoPrincipal,
          mesComAceleracao: novoMes,
          mesesAdiantados: mesAtualAlvoPrincipal - novoMes,
        };
      }
    }

    return { ...candidato, aceleracao };
  });
}
