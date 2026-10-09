import { Button } from "@/components/ui/button";
import type { Categoria } from "@/generated/prisma";

export function CategoriaForm({
  action,
  categoria,
  raizesDisponiveis,
  modoEdicao = false,
}: {
  action: (formData: FormData) => void;
  categoria?: Categoria;
  raizesDisponiveis: { id: string; nome: string }[];
  modoEdicao?: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-4 glass-card rounded-2xl p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome" required>
          <input
            name="nome"
            defaultValue={categoria?.nome}
            required
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Categoria-mãe" hint="deixe em branco pra criar uma categoria raiz">
          <select
            name="parentId"
            defaultValue={categoria?.parentId ?? ""}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">(nenhuma — categoria raiz)</option>
            {raizesDisponiveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="protegidaDeCorte"
          defaultChecked={categoria?.protegidaDeCorte ?? false}
          className="mt-0.5"
        />
        <span>
          Não sugerir corte aqui (IA)
          <span className="block text-xs text-muted-foreground">
            Ex.: aluguel de onde mora, ou algo que já é o custo de uma dívida otimizada pela rota de quitação, não
            por corte de gasto.
          </span>
        </span>
      </label>

      <div>
        <Button type="submit">{modoEdicao ? "Salvar alterações" : "Criar categoria"}</Button>
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
