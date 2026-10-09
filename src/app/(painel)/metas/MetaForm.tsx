import { centavosParaReais, formatarBRL } from "@/lib/money";
import type { Meta } from "@/generated/prisma";
import { Button } from "@/components/ui/button";

type MetaComPassivos = Meta & { passivosAlvo: { passivoId: string }[] };

export function MetaForm({
  action,
  meta,
  passivosDisponiveis,
  modoEdicao = false,
}: {
  action: (formData: FormData) => void;
  meta?: MetaComPassivos;
  passivosDisponiveis: { id: string; nome: string; valorQuitacaoCentavos: number | null }[];
  modoEdicao?: boolean;
}) {
  const dataAlvoValue = meta ? new Date(meta.dataAlvo).toISOString().slice(0, 10) : undefined;
  const passivosSelecionados = new Set(meta?.passivosAlvo.map((p) => p.passivoId) ?? []);

  return (
    <form action={action} className="flex flex-col gap-4 glass-card rounded-2xl p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome" required>
          <input
            name="nome"
            defaultValue={meta?.nome}
            required
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Valor-alvo (R$) — opcional se marcar passivo-alvo com saldo documentado, o valor final vem de lá">
          <input
            name="valorAlvo"
            type="text"
            inputMode="decimal"
            defaultValue={meta ? centavosParaReais(meta.valorAlvoCentavos) : undefined}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Data-alvo" required>
          <input
            name="dataAlvo"
            type="date"
            required
            defaultValue={dataAlvoValue}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        {modoEdicao && (
          <Campo label="Status">
            <select
              name="status"
              defaultValue={meta?.status}
              className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
            >
              <option value="ATIVA">Ativa</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </Campo>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Passivos-alvo</label>
        <div className="mt-1 flex flex-col gap-1 rounded border border-border p-2">
          {passivosDisponiveis.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="passivosAlvo"
                value={p.id}
                defaultChecked={passivosSelecionados.has(p.id)}
              />
              {p.nome}
              {p.valorQuitacaoCentavos != null && (
                <span className="text-muted-foreground">— {formatarBRL(p.valorQuitacaoCentavos)}</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Button type="submit">{modoEdicao ? "Salvar alterações" : "Criar meta"}</Button>
      </div>
    </form>
  );
}

function Campo({
  label,
  required,
  children,
}: {
  label: string;
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
    </div>
  );
}
