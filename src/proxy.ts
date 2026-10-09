import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerConfigAuth, ROTAS_AUTH } from "@/lib/auth/config";
import { nomeCookieSessao, validarSessao } from "@/lib/auth/sessao";

/**
 * Primeira barreira do login único: o sistema inteiro é privado, então TUDO exige sessão, menos a
 * lista curta abaixo (entrada/saída pelo Hub, back-channel, saúde e arquivos estáticos). Proxy roda
 * em Node (Next 16), então confere a sessão no banco de verdade, não só a presença do cookie.
 * Ainda assim, o layout do painel, cada Server Action e cada rota de API privada conferem de novo.
 *
 * Sem sessão: navegação (GET) vai para /auth/hub/iniciar com a tela pedida como destino; qualquer
 * outra coisa (POST de Server Action, API) recebe 401.
 */
const PUBLICAS = [/^\/auth(\/|$)/, /^\/api\/saude$/];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLICAS.some((r) => r.test(pathname))) return NextResponse.next();
  const cfg = lerConfigAuth();
  if (cfg.desligada) return NextResponse.next();

  const sessao = await validarSessao(prisma, request.cookies.get(nomeCookieSessao())?.value);
  if (sessao) return NextResponse.next();

  if (request.method === "GET" || request.method === "HEAD") {
    const base = cfg.appUrl || request.nextUrl.origin;
    const url = new URL(ROTAS_AUTH.iniciar, base);
    url.searchParams.set("target_link_uri", `${base}${pathname}${search}`);
    return NextResponse.redirect(url, 307);
  }
  return new NextResponse("Sessão expirada. Recarregue a página para entrar de novo pelo Hub.", {
    status: 401,
    headers: { "cache-control": "no-store" },
  });
}

export const config = {
  // Tudo menos os arquivos do próprio Next e os estáticos da raiz.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt)$).*)"],
};
