import { AtivoForm } from "../AtivoForm";
import { criarAtivo } from "../actions";

export default function NovoAtivoPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Novo ativo</h1>
      <AtivoForm action={criarAtivo} />
    </div>
  );
}
