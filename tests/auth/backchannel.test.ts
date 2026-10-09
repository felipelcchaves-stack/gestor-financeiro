import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload } from "jose";
import { EVENTO_LOGOUT, LogoutTokenInvalido, verificarLogoutToken } from "../../src/lib/auth/backchannel";

const ISS = "http://localhost:3040/oidc";
const AUD = "hub-5-teste";

async function chaves() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  return { privateKey, keys: createLocalJWKSet({ keys: [jwk] }) };
}

async function assinar(privateKey: CryptoKey, payload: JWTPayload, opts: { iss?: string; aud?: string; iat?: number } = {}) {
  const jwt = new SignJWT(payload).setProtectedHeader({ alg: "RS256", kid: "k1", typ: "logout+jwt" }).setIssuer(opts.iss ?? ISS).setAudience(opts.aud ?? AUD).setJti(crypto.randomUUID());
  if (opts.iat !== undefined) jwt.setIssuedAt(opts.iat);
  else jwt.setIssuedAt();
  return jwt.sign(privateKey);
}

const evento = { events: { [EVENTO_LOGOUT]: {} } };

test("logout_token válido devolve sid e sub", async () => {
  const { privateKey, keys } = await chaves();
  const t = await assinar(privateKey, { ...evento, sid: "sid-1", sub: "7" });
  assert.deepEqual(await verificarLogoutToken(t, { issuer: ISS, clientId: AUD, chaves: keys }), { sid: "sid-1", sub: "7" });
  const soSub = await assinar(privateKey, { ...evento, sub: "7" });
  assert.deepEqual(await verificarLogoutToken(soSub, { issuer: ISS, clientId: AUD, chaves: keys }), { sid: null, sub: "7" });
});

test("recusa: assinatura de outra chave, iss/aud errados, velho, sem evento, com nonce, sem sid/sub", async () => {
  const { privateKey, keys } = await chaves();
  const outra = await chaves();
  const c = { issuer: ISS, clientId: AUD, chaves: keys };
  const casos: Promise<string>[] = [
    assinar(outra.privateKey, { ...evento, sid: "s" }),
    assinar(privateKey, { ...evento, sid: "s" }, { iss: "https://evil/oidc" }),
    assinar(privateKey, { ...evento, sid: "s" }, { aud: "outro-cliente" }),
    assinar(privateKey, { ...evento, sid: "s" }, { iat: Math.floor(Date.now() / 1000) - 3600 }),
    assinar(privateKey, { sid: "s" }),
    assinar(privateKey, { events: { "http://outro/evento": {} }, sid: "s" }),
    assinar(privateKey, { ...evento, sid: "s", nonce: "n" }),
    assinar(privateKey, { ...evento }),
  ];
  for (const p of casos) await assert.rejects(verificarLogoutToken(await p, c), LogoutTokenInvalido);
  await assert.rejects(verificarLogoutToken("", c), LogoutTokenInvalido);
  await assert.rejects(verificarLogoutToken("a.b.c", c), LogoutTokenInvalido);
});
