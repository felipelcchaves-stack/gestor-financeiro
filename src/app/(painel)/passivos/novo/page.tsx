import { PassivoForm } from "../PassivoForm";
import { criarPassivo } from "../actions";

export default function NovoPassivoPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Novo passivo</h1>
      <PassivoForm action={criarPassivo} />
    </div>
  );
}
