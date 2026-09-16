import { prisma } from "@/lib/prisma";
import { AtaqueRapidoForm } from "./AtaqueRapidoForm";
import { EstruturaPassivo } from "@/generated/prisma";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

// Dívida "pequena" pra fins de pré-seleção: até R$50.000 de saldo e que não
// seja um dos três grandes passivos só-juros (esses já são o foco do Mapa
// principal). O usuário pode adicionar ou tirar qualquer uma na tela.
const LIMITE_DIVIDA_PEQUENA_CENTAVOS = 5_000_000;

export default async function AtaqueRapidoPage() {
  const [passivos, configuracao] = await Promise.all([
    prisma.passivo.findMany({ where: { status: "ATIVO" }, orderBy: { valorQuitacaoCentavos: "asc" } }),
    prisma.configuracao.findUnique({ where: { id: "singleton" } }),
  ]);

  const elegiveis = passivos.filter((p) => p.valorQuitacaoCentavos != null);
  const semValor = passivos.filter((p) => p.valorQuitacaoCentavos == null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Ferramentas"
        title="Ataque rápido"
        description="Foco nas dívidas menores que mordem seu caixa todo mês — cartão, financiamento pequeno, parcela solta. Aqui a pergunta é uma só: quanto tempo até elas virarem pó?"
      />

      {semValor.length > 0 && (
        <p className="rounded-lg border border-gold/20 bg-gold/[0.06] p-3 text-xs text-gold">
          Fora da simulação por não terem saldo total documentado:{" "}
          {semValor.map((p) => p.nome).join(", ")}.
        </p>
      )}

      <AtaqueRapidoForm
        passivos={elegiveis.map((p) => ({
          id: p.id,
          nome: p.nome,
          saldoCentavos: p.valorQuitacaoCentavos!,
          custoMensalCentavos: p.custoMensalCentavos ?? 0,
          estrutura: p.estrutura,
          grande: p.estrutura === EstruturaPassivo.SO_JUROS_SEM_AMORTIZACAO || p.valorQuitacaoCentavos! > LIMITE_DIVIDA_PEQUENA_CENTAVOS,
        }))}
        aporteInicialCentavos={configuracao?.aporteMensalExtraCentavos ?? null}
      />
    </div>
  );
}
