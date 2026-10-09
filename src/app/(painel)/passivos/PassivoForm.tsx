import { centavosParaReais } from "@/lib/money";
import type { Passivo } from "@/generated/prisma";
import { Button } from "@/components/ui/button";

export function PassivoForm({
  action,
  passivo,
  modoEdicao = false,
}: {
  action: (formData: FormData) => void;
  passivo?: Passivo;
  modoEdicao?: boolean;
}) {
  return (
    <form action={action} className="glass-card flex flex-col gap-4 rounded-2xl p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome / credor" required>
          <input
            name="nome"
            defaultValue={passivo?.nome}
            required
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Tipo" required hint="livre: agiota, consignado, cartao, divida-honra…">
          <input
            name="tipo"
            defaultValue={passivo?.tipo}
            required
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Estrutura" required>
          <select
            name="estrutura"
            defaultValue={passivo?.estrutura ?? "AMORTIZA_NORMAL"}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="AMORTIZA_NORMAL">Amortiza normalmente</option>
            <option value="SO_JUROS_SEM_AMORTIZACAO">Só juros, sem amortização</option>
            <option value="SEM_JUROS">Sem juros</option>
          </select>
        </Campo>

        <Campo label="Taxa de juros (% a.m.)">
          <input
            name="taxaJurosPct"
            type="text"
            inputMode="decimal"
            defaultValue={passivo?.taxaJurosPct ?? undefined}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Valor de quitação integral (R$)" hint="deixe em branco se não documentado">
          <input
            name="valorQuitacao"
            type="text"
            inputMode="decimal"
            defaultValue={
              passivo?.valorQuitacaoCentavos != null
                ? centavosParaReais(passivo.valorQuitacaoCentavos)
                : undefined
            }
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Custo mensal (R$)" hint="deixe em branco se variável por ciclo">
          <input
            name="custoMensal"
            type="text"
            inputMode="decimal"
            defaultValue={
              passivo?.custoMensalCentavos != null
                ? centavosParaReais(passivo.custoMensalCentavos)
                : undefined
            }
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Parcela atual">
          <input
            name="parcelaAtual"
            type="text"
            inputMode="numeric"
            defaultValue={passivo?.parcelaAtual ?? undefined}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Total de parcelas">
          <input
            name="totalParcelas"
            type="text"
            inputMode="numeric"
            defaultValue={passivo?.totalParcelas ?? undefined}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="custoMensalVariavel"
          defaultChecked={passivo?.custoMensalVariavel}
        />
        Custo mensal variável (ex: cartão de crédito) — lançar valor por ciclo em vez de fixo
      </label>

      {modoEdicao && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="substituido" defaultChecked={passivo?.substituido} />
          Não contar como vitória na trilha (foi substituído/reorganizado em outros passivos, não pago de verdade)
        </label>
      )}

      <Campo label="Observação">
        <textarea
          name="observacao"
          defaultValue={passivo?.observacao ?? undefined}
          rows={2}
          className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
        />
      </Campo>

      <Campo
        label="Documento-fonte (contrato, comprovante etc.)"
        hint={
          passivo?.documentoFonteId
            ? "já existe um anexado — escolher outro arquivo aqui substitui a referência"
            : "opcional — PDF ou imagem que sustenta esse valor, pra rastreabilidade"
        }
      >
        <input name="documentoFonte" type="file" accept="application/pdf,image/*" className="text-sm text-muted-foreground" />
        {passivo?.documentoFonteId && (
          <a
            href={`/api/documentos/${passivo.documentoFonteId}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 w-fit text-xs text-gold underline underline-offset-4"
          >
            ver documento atual
          </a>
        )}
      </Campo>

      {modoEdicao && (
        <Campo label="Motivo da mudança" hint="opcional — registrado no histórico se valor ou custo mudarem">
          <input
            name="motivo"
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>
      )}

      <div>
        <Button type="submit">{modoEdicao ? "Salvar alterações" : "Criar passivo"}</Button>
      </div>
    </form>
  );
}

function Campo({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-debt"> *</span>}
      </label>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
    </div>
  );
}
