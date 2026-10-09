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

export function ipDoCliente(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export const SEM_CACHE = { "cache-control": "no-store" } as const;
