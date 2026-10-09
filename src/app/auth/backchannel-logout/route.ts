import { prisma } from "@/lib/prisma";
import { chavesRemotas, verificarLogoutToken } from "@/lib/auth/backchannel";
import { lerConfigAuth } from "@/lib/auth/config";
import { jwksUriDoHub } from "@/lib/auth/hub";
import { SEM_CACHE } from "@/lib/auth/http";
import { encerrarSessoesDoHub } from "@/lib/auth/sessao";

export const dynamic = "force-dynamic";

/**
 * POST /auth/backchannel-logout (logout_token=<JWT>) — chamada servidor a servidor pelo Hub, sem
 * cookie e sem CSRF (pública no proxy.ts). Responde 200 rápido; token inválido → 400.
 */
export async function POST(req: Request) {
  const cfg = lerConfigAuth();
  if (!cfg.hub) return Response.json({ error: "invalid_request" }, { status: 400, headers: SEM_CACHE });
  try {
    const form = await req.formData();
    const token = String(form.get("logout_token") ?? "");
    const alvo = await verificarLogoutToken(token, {
      issuer: cfg.hub.issuer,
      clientId: cfg.hub.clientId,
      chaves: chavesRemotas(await jwksUriDoHub(cfg.hub)),
    });
    const n = await encerrarSessoesDoHub(prisma, alvo);
    console.info(`[hub-sso] back-channel: ${n} sessão(ões) encerrada(s)`);
    return new Response(null, { status: 200, headers: SEM_CACHE });
  } catch (e) {
    console.warn("[hub-sso] back-channel recusado:", (e as Error).message);
    return Response.json({ error: "invalid_request" }, { status: 400, headers: SEM_CACHE });
  }
}
