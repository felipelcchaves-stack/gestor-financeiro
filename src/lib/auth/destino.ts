/**
 * Para onde a pessoa volta depois do login, e o cookie de ida e volta com o Hub (PKCE verifier,
 * state, nonce e destino). Puro: sem Next, testável.
 */

export const DESTINO_PADRAO = "/";

const ehCaminhoInterno = (p: string) =>
  p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") && !p.startsWith("/auth/") && p !== "/auth" && !p.startsWith("/api/") && !p.includes("..");

/**
 * Destino pedido pelo Hub (`target_link_uri`, absoluto) ou pelo próprio sistema (caminho). Só vale
 * um caminho do próprio painel, na mesma origem do APP_URL; qualquer outra coisa (outro domínio,
 * rotas /auth e /api, lixo) vira "/" — nunca um redirecionamento aberto.
 */
export function destinoSeguro(bruto: string | null | undefined, appUrl: string): string {
  if (!bruto) return DESTINO_PADRAO;
  try {
    const origem = new URL(appUrl).origin;
    const u = new URL(bruto, origem);
    if (u.origin !== origem) return DESTINO_PADRAO;
    const caminho = u.pathname + u.search;
    return ehCaminhoInterno(u.pathname) && caminho.length <= 1024 ? caminho : DESTINO_PADRAO;
  } catch {
    return DESTINO_PADRAO;
  }
}

export type LoginPendente = { verifier: string; state: string; nonce: string; destino: string };

export const codificarPendente = (p: LoginPendente): string => Buffer.from(JSON.stringify(p)).toString("base64url");

export function decodificarPendente(bruto: string | undefined, appUrl: string): LoginPendente | null {
  if (!bruto || bruto.length > 4096) return null;
  try {
    const v = JSON.parse(Buffer.from(bruto, "base64url").toString("utf8")) as Partial<LoginPendente>;
    if (typeof v.verifier !== "string" || typeof v.state !== "string" || typeof v.nonce !== "string") return null;
    return { verifier: v.verifier, state: v.state, nonce: v.nonce, destino: destinoSeguro(v.destino, appUrl) };
  } catch {
    return null;
  }
}
