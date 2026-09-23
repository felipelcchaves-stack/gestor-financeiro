import { carregarEstadoAtual } from "@/lib/estadoAtual";
import { calcularQualidadeDados } from "@/lib/qualidadeDados";
import { calcularMovimentacaoDoMes, calcularTrajetoriaRealPassivo, inicioDoPeriodo, type PontoSaldo } from "@/lib/ofensores";
import { calcularStatusRateio } from "@/lib/rateio";
import { gerarResumoMarkdown } from "@/lib/resumoIA";
import { CopiarResumo } from "./CopiarResumo";
import { SugestaoIA } from "@/components/SugestaoIA";
import { gerarSugestaoCorteIA, obterUltimaSugestaoGeral } from "./actions";

export const dynamic = "force-dynamic";

export default async function ResumoIAPage() {
  const estado = await carregarEstadoAtual();
  const [qualidadeDados, movimentacaoDoMes, statusRateio, sugestaoSalva] = await Promise.all([
    calcularQualidadeDados(),
    calcularMovimentacaoDoMes(inicioDoPeriodo("mes")),
    calcularStatusRateio(estado),
    obterUltimaSugestaoGeral(),
  ]);

  const trajetorias = await Promise.all(estado.passivosAtivos.map((p) => calcularTrajetoriaRealPassivo(p.id)));
  const trajetoriasPorPassivo = new Map<string, PontoSaldo[]>(estado.passivosAtivos.map((p, i) => [p.id, trajetorias[i]]));

  const markdown = gerarResumoMarkdown(estado, qualidadeDados, movimentacaoDoMes, trajetoriasPorPassivo, statusRateio);

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

      <div className="mt-4 border-t border-border pt-4">
        <h2 className="text-base font-semibold text-foreground">Ou peça uma sugestão automática</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
          Diferente do bloco acima (que só sai se você mesmo colar em algum lugar), isso manda os totais por
          categoria pra API do Gemini e abre a análise numa aba lateral.
        </p>
        <div className="mt-3">
          <SugestaoIA sugestaoInicial={sugestaoSalva} acaoGerar={gerarSugestaoCorteIA} titulo="Sugestão de corte de gastos" />
        </div>
      </div>
    </div>
  );
}
