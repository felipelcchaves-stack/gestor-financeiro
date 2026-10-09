import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerConfigAuth, ROTAS_AUTH } from "@/lib/auth/config";
import { nomeCookieSessao } from "@/lib/auth/cookies";
import { urlSairNoHub } from "@/lib/auth/hub";
import { basePublica } from "@/lib/auth/http";
import { encerrarSessaoPorToken, validarSessao } from "@/lib/auth/sessao";

export const dynamic = "force-dynamic";

/**
 * POST /auth/sair — "Sair" no menu. Apaga a sessão local e, se ela veio do Hub, segue para o
 * end_session do Hub (RP-initiated logout), que pergunta se a pessoa quer sair de todos os
 * sistemas e volta para /auth/saiu. Cookie SameSite=Lax: um POST vindo de outro site não leva o
 * cookie, então não derruba a sessão de ninguém.
 */
export async function POST(req: Request) {
  const cfg = lerConfigAuth();
  const base = basePublica(req, cfg.appUrl);
  const jar = await cookies();
  const token = jar.get(nomeCookieSessao())?.value;
  const sessao = await validarSessao(prisma, token);
  await encerrarSessaoPorToken(prisma, token);

  let destino = `${base}${ROTAS_AUTH.saiu}`;
  if (sessao?.origem === "hub" && cfg.hub) destino = (await urlSairNoHub(cfg.hub, `${base}${ROTAS_AUTH.saiu}`)) ?? destino;

  const res = NextResponse.redirect(destino, 303);
  res.cookies.set(nomeCookieSessao(), "", { path: "/", maxAge: 0, httpOnly: true, secure: cfg.producao, sameSite: "lax" });
  res.headers.set("cache-control", "no-store");
  return res;
}
