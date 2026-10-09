/** Nomes e opções dos cookies do login. httpOnly sempre; Secure + prefixo __Host- em produção. */
import { nomeCookieSessao } from "./sessao";

const prod = () => process.env.NODE_ENV === "production";

export { nomeCookieSessao };

export const nomeCookiePendente = () => (prod() ? "__Host-gestor_hub_login" : "gestor_hub_login");
export const PENDENTE_TTL_S = 600;

export const opcoesCookiePendente = () => ({ httpOnly: true, secure: prod(), sameSite: "lax" as const, path: "/", maxAge: PENDENTE_TTL_S });

export const opcoesCookieSessao = (expiraEm: Date) => ({ httpOnly: true, secure: prod(), sameSite: "lax" as const, path: "/", expires: expiraEm });
