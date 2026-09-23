// Substitui src/lib/gemini.ts (removido) — a chave do Gemini era free
// tier com um limite de só 20 chamadas/dia, compartilhado entre local
// e VPS porque as duas usavam a mesma chave; testes locais esgotaram a
// cota e travaram o botão real do Felipe em produção. Trocado pelo
// Claude por decisão explícita do Felipe: API paga desde a primeira
// chamada (sem free tier pra estourar), mas cada ambiente já usa uma
// chave própria (ANTHROPIC_API_KEY local ≠ da VPS) — nunca mais um
// teste daqui derruba o uso real dele.
//
// IMPORTANTE: uma assinatura Pro/Max do claude.ai NÃO dá acesso a
// isso — a API é um produto separado, cobrado por uso, com chave
// própria em console.anthropic.com.

const MODELO_PADRAO = "claude-haiku-4-5-20251001";
const VERSAO_API = "2023-06-01";
const NOME_FERRAMENTA = "responder_sugestao_corte";

type OpcoesChamarClaude = {
  // Quando informado (JSON Schema), força a resposta a vir estruturada
  // nesse formato via "tool use" forçado — o jeito confiável de pedir
  // JSON pro Claude, em vez de confiar em regex sobre texto livre.
  schema?: object;
};

export async function chamarClaude(prompt: string, opcoes?: OpcoesChamarClaude): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Gere uma em https://console.anthropic.com (API paga, diferente de uma assinatura Pro/Max do claude.ai) e adicione no .env."
    );
  }

  const modelo = process.env.CLAUDE_MODEL || MODELO_PADRAO;

  const corpoRequisicao: Record<string, unknown> = {
    model: modelo,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  };

  if (opcoes?.schema) {
    corpoRequisicao.tools = [
      { name: NOME_FERRAMENTA, description: "Estrutura da sugestão de corte de gastos.", input_schema: opcoes.schema },
    ];
    corpoRequisicao.tool_choice = { type: "tool", name: NOME_FERRAMENTA };
  }

  let resposta: Response;
  try {
    resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": VERSAO_API,
      },
      body: JSON.stringify(corpoRequisicao),
      // Mesmo horizonte já validado com prompts grandes (várias dívidas
      // + subcategoria + comparação) no Gemini — 30s se mostrou curto
      // na prática.
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error("Não consegui contactar a API do Claude (rede fora ou timeout). Tente de novo em alguns instantes.");
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    if (resposta.status === 429) {
      throw new Error("A API do Claude está com limite de taxa no momento (não é falta de cota paga) — tente de novo em alguns segundos.");
    }
    if (resposta.status === 401) {
      throw new Error("ANTHROPIC_API_KEY inválida ou sem crédito. Confira em https://console.anthropic.com.");
    }
    throw new Error(`Claude retornou erro ${resposta.status}. ${corpo.slice(0, 300)}`);
  }

  const dados = await resposta.json();

  if (opcoes?.schema) {
    const blocoFerramenta = dados?.content?.find(
      (bloco: { type?: string; name?: string }) => bloco.type === "tool_use" && bloco.name === NOME_FERRAMENTA
    );
    if (!blocoFerramenta?.input) {
      throw new Error("Resposta do Claude veio sem o formato estruturado esperado — tente de novo.");
    }
    return JSON.stringify(blocoFerramenta.input);
  }

  const blocoTexto = dados?.content?.find((bloco: { type?: string }) => bloco.type === "text");
  const texto = blocoTexto?.text;
  if (typeof texto !== "string" || texto.trim().length === 0) {
    throw new Error("Resposta do Claude veio sem texto — tente de novo.");
  }

  return texto;
}
