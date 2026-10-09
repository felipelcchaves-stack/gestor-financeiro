import { centavosParaReais } from "@/lib/money";
import { ordenarCategoriasHierarquicamente, type CategoriaOpcao } from "@/lib/categorias";
import { Button } from "@/components/ui/button";
import type { RecorrenciaFinanceira } from "@/generated/prisma";

export function RecorrenciaForm({
  action,
  recorrencia,
  categorias,
  cartoes,
  modoEdicao = false,
}: {
  action: (formData: FormData) => void;
  recorrencia?: RecorrenciaFinanceira;
  categorias: CategoriaOpcao[];
  cartoes: { id: string; nome: string }[];
  modoEdicao?: boolean;
}) {
  const opcoesCategoria = ordenarCategoriasHierarquicamente(categorias);

  return (
    <form action={action} className="flex flex-col gap-4 glass-card rounded-2xl p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome" required>
          <input
            name="nome"
            defaultValue={recorrencia?.nome}
            required
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Tipo" required>
          <select
            name="tipo"
            defaultValue={recorrencia?.tipo ?? "DESPESA"}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="DESPESA">Despesa</option>
            <option value="ENTRADA">Entrada</option>
          </select>
        </Campo>

        <Campo label="Valor (R$)" required>
          <input
            name="valor"
            type="text"
            inputMode="decimal"
            required
            defaultValue={recorrencia ? centavosParaReais(recorrencia.valorCentavos) : undefined}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          />
        </Campo>

        <Campo label="Frequência" required>
          <select
            name="frequencia"
            defaultValue={recorrencia?.frequencia ?? "MENSAL"}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="MENSAL">Mensal</option>
            <option value="SEMANAL">Semanal</option>
            <option value="ANUAL">Anual</option>
            <option value="UNICA">Única</option>
          </select>
        </Campo>

        <Campo label="Confiabilidade" required hint="quanto essa recorrência é garantida">
          <select
            name="confiabilidade"
            defaultValue={recorrencia?.confiabilidade ?? "CONFIRMADO"}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="CONFIRMADO">Confirmado</option>
            <option value="ESTIMADO">Estimado</option>
          </select>
        </Campo>

        <Campo label="Categoria">
          <select
            name="categoriaId"
            defaultValue={recorrencia?.categoriaId ?? ""}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">nenhuma</option>
            {opcoesCategoria.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Cartão" hint="se essa despesa é cobrada num cartão específico">
          <select
            name="passivoId"
            defaultValue={recorrencia?.passivoId ?? ""}
            className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">nenhum</option>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>

        <div className="flex items-end pb-1.5">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" name="essencial" value="1" defaultChecked={recorrencia?.essencial ?? false} />
            Essencial (não pode parar de existir)
          </label>
        </div>
      </div>

      <Campo label="Observação">
        <textarea
          name="observacao"
          defaultValue={recorrencia?.observacao ?? undefined}
          rows={2}
          className="w-full rounded-lg border border-input bg-input/30 px-2 py-1.5 text-sm text-foreground"
        />
      </Campo>

      <div>
        <Button type="submit">{modoEdicao ? "Salvar alterações" : "Criar recorrência"}</Button>
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
