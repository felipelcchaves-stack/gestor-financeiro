import { NextResponse } from "next/server";
import { emissorConfere, lerConfigAuth, ROTAS_AUTH } from "@/lib/auth/config";
import { codificarPendente, destinoSeguro } from "@/lib/auth/destino";
import { iniciarLoginHub } from "@/lib/auth/hub";
import { basePublica, SEM_CACHE, urlAviso } from "@/lib/auth/http";
import { nomeCookiePendente, opcoesCookiePendente } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

/**
 * GET /auth/hub/iniciar[?iss=...&target_link_uri=...] — início do login pelo Hub.
 *
 * - É o `initiate_login_uri` do cliente no Hub (OIDC third-party initiated login): abrir o Gestor
 *   no lançador do Hub cai aqui e termina DENTRO do sistema, já logado.
 * - Também é para onde o proxy e as páginas mandam quem chega sem sessão (`target_link_uri` =
 *   a tela pedida). Funciona sem parâmetro nenhum (destino "/").
 * - `iss`, se vier, precisa ser o emissor configurado. `target_link_uri` só vale se for um caminho
 *   do próprio sistema (mesma origem do APP_URL); senão, "/".
 * - SSO desligado: login de emergência (se ligado) ou "Acesso não configurado".
 */
export async function GET(req: Request) {
  const cfg = lerConfigAuth();
  const base = basePublica(req, cfg.appUrl);
  const params = new URL(req.url).searchParams;
  const destino = destinoSeguro(params.get("target_link_uri") ?? params.get("next"), base);

  if (cfg.desligada) return NextResponse.redirect(new URL(destino, base), 303);
  if (!cfg.hub) {
    if (cfg.emergencia) return NextResponse.redirect(new URL(`${ROTAS_AUTH.emergencia}?destino=${encodeURIComponent(destino)}`, base), 303);
    return NextResponse.redirect(urlAviso(req, cfg.appUrl, "nao_configurado"), 303);
  }

  const iss = params.get("iss");
  if (iss !== null && !emissorConfere(iss, cfg.hub.issuer)) return NextResponse.redirect(urlAviso(req, cfg.appUrl, "emissor"), 303);

  try {
    const { url, pendente } = await iniciarLoginHub(cfg.hub, `${base}${ROTAS_AUTH.callback}`, destino);
    const res = NextResponse.redirect(url, 303);
    res.cookies.set(nomeCookiePendente(), codificarPendente(pendente), opcoesCookiePendente());
    res.headers.set("cache-control", SEM_CACHE["cache-control"]);
    return res;
  } catch (e) {
    console.error("[hub-sso] descoberta do Hub falhou:", (e as Error).message);
    return NextResponse.redirect(urlAviso(req, cfg.appUrl, "falha"), 303);
  }
}
