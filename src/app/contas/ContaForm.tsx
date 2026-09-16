import { Button } from "@/components/ui/button";

export function ContaForm({ action }: { action: (formData: FormData) => void }) {
  return (
    <form action={action} className="flex flex-col gap-4 glass-card rounded-2xl p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Nome <span className="text-debt">*</span>
          </label>
          <input name="nome" required className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Tipo <span className="text-debt">*</span>
          </label>
          <select name="tipo" className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground">
            <option value="CORRENTE_PF">Corrente PF</option>
            <option value="CORRENTE_PJ">Corrente PJ</option>
            <option value="CHEQUE_ESPECIAL">Cheque especial</option>
            <option value="POUPANCA">Poupança</option>
            <option value="CARTAO_CREDITO">Cartão de crédito</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Limite cheque especial (R$)</label>
          <input
            name="limiteChequeEspecial"
            type="text"
            inputMode="decimal"
            className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Taxa cheque especial (% a.m.)</label>
          <input
            name="taxaJurosChequeEspecial"
            type="text"
            inputMode="decimal"
            className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Carência (dias)</label>
          <input
            name="carenciaDiasChequeEspecial"
            type="text"
            inputMode="numeric"
            className="rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </div>
      </div>

      <div>
        <Button type="submit">Criar conta</Button>
      </div>
    </form>
  );
}
