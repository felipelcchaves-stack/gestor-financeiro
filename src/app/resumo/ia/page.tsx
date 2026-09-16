import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { gerarResumoMarkdown } from "@/lib/resumoIA";
import { CopiarResumo } from "./CopiarResumo";

export const dynamic = "force-dynamic";

export default async function ResumoIAPage() {
  const estado = await carregarEstadoAtual();
  const markdown = gerarResumoMarkdown(estado);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Resumo para revisar com IA</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Copie o texto abaixo e cole numa conversa com o Claude (ou outra IA) pra pedir uma
          segunda opinião sobre o caminho que você está seguindo. Nada é enviado
          automaticamente — só sai daqui se você colar em algum lugar.
        </p>
      </div>

      <CopiarResumo markdown={markdown} />
    </div>
  );
}
