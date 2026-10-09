/**
 * Cliente OIDC do Hub (openid-client v6): descoberta em cache, URL de autorização com PKCE (S256)
 * + state + nonce, troca do código (valida state, PKCE, assinatura pelo JWKS, iss, aud, exp, nonce)
 * e URL de "Sair" no Hub (RP-initiated logout).
 */
import { createHash } from "node:crypto";
import * as oidc from "openid-client";
import type { HubSsoConfig } from "./config";
import type { LoginPendente } from "./destino";
import type { ClaimsHub } from "./vinculo";

const TIMEOUT_S = 8;
const cache = new Map<string, Promise<oidc.Configuration>>();

/** http:// só para o Hub local em desenvolvimento. */
export function inseguroPermitido(issuer: string, producao = process.env.NODE_ENV === "production"): boolean {
  try {
    const u = new URL(issuer);
    return !producao && u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

const chave = (c: HubSsoConfig) => `${c.issuer}|${c.clientId}|${c.tokenAuthMethod}|${createHash("sha256").update(c.clientSecret).digest("hex")}`;

/** Descoberta do Hub em cache por (emissor, client_id, método, segredo). Falha não fica em cache. */
export function configHub(c: HubSsoConfig): Promise<oidc.Configuration> {
  const k = chave(c);
  let hit = cache.get(k);
  if (!hit) {
    const auth = c.tokenAuthMethod === "client_secret_post" ? oidc.ClientSecretPost(c.clientSecret) : oidc.ClientSecretBasic(c.clientSecret);
    hit = oidc
      .discovery(new URL(c.issuer), c.clientId, undefined, auth, {
        timeout: TIMEOUT_S,
        ...(inseguroPermitido(c.issuer) ? { execute: [oidc.allowInsecureRequests] } : {}),
      })
      .catch((err: unknown) => {
        cache.delete(k);
        throw err;
      });
    cache.set(k, hit);
  }
  return hit;
}

/**
 * O Hub responde AGORA? Descoberta nova, sem cache e com timeout curto — usada pelo login de
 * emergência (o cache de configHub vive para sempre e mentiria durante uma queda do Hub).
 */
export async function hubRespondeAgora(c: HubSsoConfig, timeoutS = 3): Promise<boolean> {
  try {
    await oidc.discovery(new URL(c.issuer), c.clientId, undefined, oidc.None(), {
      timeout: timeoutS,
      ...(inseguroPermitido(c.issuer) ? { execute: [oidc.allowInsecureRequests] } : {}),
    });
    return true;
  } catch {
    return false;
  }
}

export async function iniciarLoginHub(c: HubSsoConfig, redirectUri: string, destino: string): Promise<{ url: URL; pendente: LoginPendente }> {
  const config = await configHub(c);
  const verifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: c.scopes,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state,
    nonce,
  });
  return { url, pendente: { verifier, state, nonce, destino } };
}

export class ErroLoginHub extends Error {}

/** Troca o código e devolve as claims validadas. `urlAtual` = callback como cadastrado no Hub + a query recebida. */
export async function concluirLoginHub(c: HubSsoConfig, urlAtual: URL, p: LoginPendente): Promise<ClaimsHub> {
  const config = await configHub(c);
  let claims: oidc.IDToken | undefined;
  try {
    const tokens = await oidc.authorizationCodeGrant(config, urlAtual, {
      pkceCodeVerifier: p.verifier,
      expectedState: p.state,
      expectedNonce: p.nonce,
      idTokenExpected: true,
    });
    claims = tokens.claims();
  } catch (e) {
    throw new ErroLoginHub(`troca do código: ${(e as Error).message}`);
  }
  if (!claims) throw new ErroLoginHub("sem ID token");
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const out: ClaimsHub = {
    sub: str(claims.sub),
    email: str(claims.email),
    emailVerificado: claims.email_verified === true,
    nome: str(claims.name),
    papelHub: str(claims.hub_role),
    sid: str(claims.sid),
  };
  // Sem `sid` o back-channel não acharia a sessão: recusa (o Hub sempre manda).
  if (!out.sub || !out.email || !out.sid) throw new ErroLoginHub("claims incompletas");
  return out;
}

/** URL de "Sair" no Hub (pergunta se a pessoa quer sair de todos os sistemas). null se o Hub estiver fora. */
export async function urlSairNoHub(c: HubSsoConfig, postLogoutRedirectUri: string): Promise<string | null> {
  try {
    const config = await configHub(c);
    if (!config.serverMetadata().end_session_endpoint) return null;
    return oidc.buildEndSessionUrl(config, { client_id: c.clientId, post_logout_redirect_uri: postLogoutRedirectUri }).href;
  } catch {
    return null;
  }
}

/** jwks_uri da descoberta (nunca fixo em código: o Hub gira as chaves). */
export async function jwksUriDoHub(c: HubSsoConfig): Promise<string> {
  const uri = (await configHub(c)).serverMetadata().jwks_uri;
  if (!uri) throw new Error("jwks_uri ausente na descoberta");
  return uri;
}
