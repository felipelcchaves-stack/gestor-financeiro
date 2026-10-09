/** Utilidades das rotas /auth/* (sem Next: testáveis com `Request`). */
import { ROTAS_AUTH } from "./config";
import type { MotivoAviso } from "./mensagens";

/**
 * Base dos redirecionamentos: APP_URL (o endereço cadastrado no Hub). Atrás do Nginx o
 * `request.url` vira localhost:PORTA (DEPLOY_VPS.md, pegadinha 2), por isso nunca ele.
 */
export const basePublica = (req: Request, appUrl: string): string => appUrl || new URL(req.url).origin;

/** URL do callback exatamente como cadastrada no Hub, com a query que o Hub mandou. */
export function urlCallback(req: Request, appUrl: string): URL {
  const u = new URL(`${basePublica(req, appUrl)}${ROTAS_AUTH.callback}`);
  u.search = new URL(req.url).search;
  return u;
}

export const urlAviso = (req: Request, appUrl: string, motivo: MotivoAviso): URL =>
  new URL(`${ROTAS_AUTH.aviso}?motivo=${encodeURIComponent(motivo)}`, basePublica(req, appUrl));

/**
 * IP de quem fez a requisição, para limite de tentativas. Em produção vale só o `X-Real-IP` que o
 * Nginx sobrescreve com `$remote_addr` (DEPLOY_VPS.md); o primeiro item do X-Forwarded-For vem do
 * cliente e pode ser forjado, então nunca é usado. Sem X-Real-IP (dev), usa o ÚLTIMO salto do XFF
 * (o que o proxy mais próximo viu).
 */
export function ipDoCliente(h: Pick<Headers, "get">): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const saltos = (h.get("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return saltos.length ? saltos[saltos.length - 1].slice(0, 64) : "local";
}

export const SEM_CACHE = { "cache-control": "no-store" } as const;
