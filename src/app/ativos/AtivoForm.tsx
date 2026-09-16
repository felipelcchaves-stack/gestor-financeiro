import { centavosParaReais } from "@/lib/money";
import type { Ativo } from "@/generated/prisma";
import { Button } from "@/components/ui/button";

export function AtivoForm({
  action,
  ativo,
  modoEdicao = false,
}: {
  action: (formData: FormData) => void;
  ativo?: Ativo;
  modoEdicao?: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-4 glass-card rounded-2xl p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome" required>
          <input
            name="nome"
            defaultValue={ativo?.nome}
            required
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Valor (R$)" required>
          <input
            name="valor"
            type="text"
            inputMode="decimal"
            required
            defaultValue={ativo ? centavosParaReais(ativo.valorCentavos) : undefined}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Liquidez" required hint="ex: D+0, D+30">
          <input
            name="liquidez"
            defaultValue={ativo?.liquidez}
            required
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Rendimento mensal (% a.m.)" hint="deixe em branco se não souber — nunca estimamos isso sozinhos">
          <input
            name="rendimentoMensalPct"
            type="text"
            inputMode="decimal"
            defaultValue={ativo?.rendimentoMensalPct ?? undefined}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>
      </div>

      <Campo label="Observação">
        <textarea
          name="observacao"
          defaultValue={ativo?.observacao ?? undefined}
          rows={2}
          className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
        />
      </Campo>

      <div>
        <Button type="submit">{modoEdicao ? "Salvar alterações" : "Criar ativo"}</Button>
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
