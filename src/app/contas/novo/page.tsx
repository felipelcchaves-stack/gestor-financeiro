import { ContaForm } from "../ContaForm";
import { criarConta } from "../actions";

export default function NovaContaPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Nova conta</h1>
      <ContaForm action={criarConta} />
    </div>
  );
}
