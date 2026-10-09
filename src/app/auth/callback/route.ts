import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerConfigAuth } from "@/lib/auth/config";
import { nomeCookiePendente, nomeCookieSessao, opcoesCookiePendente, opcoesCookieSessao } from "@/lib/auth/cookies";
import { decodificarPendente } from "@/lib/auth/destino";
import { concluirLoginHub } from "@/lib/auth/hub";
import { basePublica, urlAviso, urlCallback } from "@/lib/auth/http";
import { criarSessao, encerrarSessaoPorToken, limparSessoesVencidas } from "@/lib/auth/sessao";
import { resolverUsuarioDoHub } from "@/lib/auth/vinculo";

export const dynamic = "force-dynamic";

/** Redireciona e apaga o cookie de ida e volta (uso único, com ou sem sucesso). */
function ir(url: URL): NextResponse {
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(nomeCookiePendente(), "", { ...opcoesCookiePendente(), maxAge: 0 });
  res.headers.set("cache-control", "no-store");
  return res;
}

/**
 * GET /auth/callback?code=...&state=... — valida tudo (state, PKCE, assinatura do ID token pelo
 * JWKS, iss, aud, exp, nonce), acha o usuário pelo `sub`/e-mail e abre a sessão local com o `sid`
 * do Hub. Nenhuma senha nem 2FA daqui: o Hub já pediu.
 */
export async function GET(req: Request) {
  const cfg = lerConfigAuth();
  if (!cfg.hub) return ir(urlAviso(req, cfg.appUrl, "nao_configurado"));
  const jar = await cookies();
  const pendente = decodificarPendente(jar.get(nomeCookiePendente())?.value, basePublica(req, cfg.appUrl));
  const params = new URL(req.url).searchParams;
  if (params.get("error")) return ir(urlAviso(req, cfg.appUrl, "negado"));
  if (!pendente || params.get("state") !== pendente.state) return ir(urlAviso(req, cfg.appUrl, "expirado"));

  let claims;
  try {
    claims = await concluirLoginHub(cfg.hub, urlCallback(req, cfg.appUrl), pendente);
  } catch (e) {
    console.error("[hub-sso] callback falhou:", (e as Error).message);
    return ir(urlAviso(req, cfg.appUrl, "falha"));
  }

  const vinculo = await resolverUsuarioDoHub(prisma, claims, cfg.hub.papeisPermitidos);
  if (!vinculo.ok) {
    console.warn(`[hub-sso] entrada recusada (${vinculo.motivo}) para o sub ${claims.sub}`);
    return ir(urlAviso(req, cfg.appUrl, vinculo.motivo));
  }

  await limparSessoesVencidas(prisma);
  const antiga = jar.get(nomeCookieSessao())?.value;
  if (antiga) await encerrarSessaoPorToken(prisma, antiga);
  const sessao = await criarSessao(prisma, { usuarioId: vinculo.usuarioId, origem: "hub", hubSid: claims.sid, hubSub: claims.sub, horas: cfg.sessaoHoras });

  const res = ir(new URL(pendente.destino, basePublica(req, cfg.appUrl)));
  res.cookies.set(nomeCookieSessao(), sessao.token, opcoesCookieSessao(sessao.expiraEm));
  return res;
}
