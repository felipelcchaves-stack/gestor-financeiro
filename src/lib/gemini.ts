// Primeira chamada de API externa deste projeto — até aqui, todo
// "IA" no app era matemática local (Consultor) ou copiar-e-colar
// manual pra fora (resumo/ia). Isso é uma decisão explícita e revertida
// de propósito pelo Felipe (ver ROADMAP.md), não um padrão a expandir
// silenciosamente pro resto do app: só a sugestão de corte de gastos
// usa isso, e sempre com aviso claro do que sai da máquina.
//
// Sem SDK novo — é uma chamada só, `fetch` nativo resolve. Nunca deixa
// vazar stack trace bruto nem derruba a tela: todo erro vira uma
// Error com mensagem legível, pro chamador decidir como mostrar.

const MODELO_PADRAO = "gemini-3-flash-preview";

type OpcoesChamarGemini = {
  // Quando informado, força a resposta a vir como JSON nesse formato
  // (subconjunto de OpenAPI aceito pelo Gemini) em vez de texto livre —
  // usado pela sugestão de corte (src/lib/promptCorteDeGastos.ts) pra
  // conseguir montar um gráfico sem depender de regex sobre markdown.
  schema?: object;
};

export async function chamarGemini(prompt: string, opcoes?: OpcoesChamarGemini): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada. Adicione sua chave no .env (veja .env.example) — https://aistudio.google.com/apikey."
    );
  }

  const modelo = process.env.GEMINI_MODEL || MODELO_PADRAO;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(opcoes?.schema
          ? { generationConfig: { responseMimeType: "application/json", responseSchema: opcoes.schema } }
          : {}),
      }),
      // 60s, não 30 — prompts maiores (várias dívidas + subcategoria,
      // saída estruturada) medem ~30-45s às vezes; visto de verdade
      // num teste real que estourava exatamente em 30s.
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error("Não consegui contactar a API do Gemini (rede fora ou timeout). Tente de novo em alguns instantes.");
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new Error(`Gemini retornou erro ${resposta.status}. ${corpo.slice(0, 300)}`);
  }

  const dados = await resposta.json();
  const texto = dados?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof texto !== "string" || texto.trim().length === 0) {
    throw new Error("Resposta do Gemini veio sem texto — tente de novo.");
  }

  return texto;
}
