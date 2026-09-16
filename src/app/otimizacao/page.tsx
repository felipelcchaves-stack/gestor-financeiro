import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { calcularQualidadeDados } from "@/lib/qualidadeDados";
import { OtimizacaoForm } from "./OtimizacaoForm";

export const dynamic = "force-dynamic";

export default async function OtimizacaoPage() {
  const [passivos, configuracao, qualidadeDados] = await Promise.all([
    prisma.passivo.findMany({
      where: { status: "ATIVO" },
      orderBy: { nome: "asc" },
    }),
    prisma.configuracao.findUnique({ where: { id: "singleton" } }),
    calcularQualidadeDados(),
  ]);

  const elegiveis = passivos.filter((p) => p.valorQuitacaoCentavos != null);
  const semValor = passivos.filter((p) => p.valorQuitacaoCentavos == null);
  const idsElegiveis = new Set(elegiveis.map((p) => p.id));
  const pendentesNaSimulacao = qualidadeDados.passivosComReconciliacaoPendente.filter((p) => idsElegiveis.has(p.id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Ferramentas"
        title="Comparar estratégias"
        description="Dado um conjunto de passivos e um aporte mensal extra, compara três estratégias de ataque lado a lado. O sistema mostra o trade-off — a escolha final é sua."
      />

      {semValor.length > 0 && (
        <p className="rounded-lg border border-gold/20 bg-gold/[0.06] p-3 text-xs text-gold">
          Fora da simulação por não terem saldo total documentado:{" "}
          {semValor.map((p) => p.nome).join(", ")}.
        </p>
      )}

      {pendentesNaSimulacao.length > 0 && (
        <p className="rounded-lg border border-debt/30 bg-debt/[0.06] p-3 text-xs text-debt">
          Atenção: {pendentesNaSimulacao.length} passivo(s) entrando nessa simulação já têm pagamento real
          registrado mas não confirmado —{" "}
          {pendentesNaSimulacao.map((p, i) => (
            <span key={p.id}>
              <Link href={`/passivos/${p.id}`} className="underline underline-offset-4">
                {p.nome}
              </Link>
              {i < pendentesNaSimulacao.length - 1 ? ", " : ""}
            </span>
          ))}
          . Os números abaixo podem estar desatualizados até você confirmar.
        </p>
      )}

      <OtimizacaoForm
        passivos={elegiveis.map((p) => ({
          id: p.id,
          nome: p.nome,
          saldoCentavos: p.valorQuitacaoCentavos!,
          custoMensalCentavos: p.custoMensalCentavos ?? 0,
          estrutura: p.estrutura,
        }))}
        aporteInicialCentavos={configuracao?.aporteMensalExtraCentavos ?? null}
        estrategiaAtiva={configuracao?.estrategiaEscolhida ?? null}
        splitHibridoPctAtivo={configuracao?.splitHibridoPct ?? null}
      />
    </div>
  );
}
