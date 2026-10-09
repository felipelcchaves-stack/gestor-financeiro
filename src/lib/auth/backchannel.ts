/**
 * Logout por back-channel (OIDC Back-Channel Logout 1.0). O Hub faz POST `logout_token=<JWT>`
 * quando a sessão de SSO acaba (sair do Hub, suspensão, remoção, expiração). Valida: assinatura
 * (JWKS da descoberta), `iss`, `aud`, `iat` recente, o evento de logout, ausência de `nonce`, e
 * `sid` ou `sub`. Sem cookie e sem CSRF: é chamada servidor a servidor.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const EVENTO_LOGOUT = "http://schemas.openid.net/event/backchannel-logout";

export class LogoutTokenInvalido extends Error {}

export async function verificarLogoutToken(
  token: string,
  c: { issuer: string; clientId: string; chaves: JWTVerifyGetKey; agora?: Date },
): Promise<{ sid: string | null; sub: string | null }> {
  if (!token || token.length > 8192) throw new LogoutTokenInvalido("token ausente");
  let payload;
  try {
    ({ payload } = await jwtVerify(token, c.chaves, {
      issuer: c.issuer,
      audience: c.clientId,
      maxTokenAge: "5m",
      requiredClaims: ["iat"],
      algorithms: ["RS256", "PS256", "ES256", "EdDSA"],
      ...(c.agora ? { currentDate: c.agora } : {}),
    }));
  } catch {
    throw new LogoutTokenInvalido("assinatura ou claims inválidas");
  }
  const eventos = payload.events as Record<string, unknown> | undefined;
  if (!eventos || typeof eventos !== "object" || !(EVENTO_LOGOUT in eventos)) throw new LogoutTokenInvalido("não é um logout_token");
  if ("nonce" in payload) throw new LogoutTokenInvalido("logout_token não pode ter nonce");
  const sid = typeof payload.sid === "string" && payload.sid ? payload.sid : null;
  const sub = typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  if (!sid && !sub) throw new LogoutTokenInvalido("sem sid nem sub");
  return { sid, sub };
}

const cacheJwks = new Map<string, JWTVerifyGetKey>();

/** JWKS remoto em cache por URL (o jose busca de novo quando aparece um `kid` novo, ou seja, na rotação). */
export function chavesRemotas(jwksUri: string): JWTVerifyGetKey {
  let k = cacheJwks.get(jwksUri);
  if (!k) {
    k = createRemoteJWKSet(new URL(jwksUri), { timeoutDuration: 3000 });
    cacheJwks.set(jwksUri, k);
  }
  return k;
}
