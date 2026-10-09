import { test } from "node:test";
import assert from "node:assert/strict";
import { emissorConfere, lerConfigAuth, urlsParaCadastrarNoHub } from "../../src/lib/auth/config";
import { codificarPendente, decodificarPendente, destinoSeguro } from "../../src/lib/auth/destino";
import { AVISOS, motivoValido } from "../../src/lib/auth/mensagens";
import { basePublica, urlCallback } from "../../src/lib/auth/http";

const APP = "https://gestor.ifatokun.com.br";

test("destinoSeguro: só caminhos do próprio sistema, nunca redirecionamento aberto", () => {
  assert.equal(destinoSeguro(null, APP), "/");
  assert.equal(destinoSeguro("", APP), "/");
  assert.equal(destinoSeguro(`${APP}/passivos?x=1`, APP), "/passivos?x=1");
  assert.equal(destinoSeguro("/cofre", APP), "/cofre");
  assert.equal(destinoSeguro(`${APP}/`, APP), "/");
  // outro domínio (inclusive o endereço de produção quando roda local) vira "/"
  assert.equal(destinoSeguro("https://evil.example/passivos", APP), "/");
  assert.equal(destinoSeguro("https://gestor.ifatokun.com.br/passivos", "http://localhost:3160"), "/");
  assert.equal(destinoSeguro("//evil.example/x", APP), "/");
  assert.equal(destinoSeguro("/\\evil.example", APP), "/");
  assert.equal(destinoSeguro("javascript:alert(1)", APP), "/");
  // rotas de login/API nunca são destino (evita laço e download direto)
  assert.equal(destinoSeguro("/auth/hub/iniciar", APP), "/");
  assert.equal(destinoSeguro("/api/documentos/1", APP), "/");
  assert.equal(destinoSeguro("/a/../auth/sair", APP), "/");
  assert.equal(destinoSeguro(`/${"x".repeat(2000)}`, APP), "/");
});

test("cookie de ida e volta: ida e volta íntegras, lixo rejeitado, destino revalidado", () => {
  const p = { verifier: "v", state: "s", nonce: "n", destino: "/metas" };
  assert.deepEqual(decodificarPendente(codificarPendente(p), APP), p);
  assert.equal(decodificarPendente(undefined, APP), null);
  assert.equal(decodificarPendente("não-é-base64-json", APP), null);
  assert.equal(decodificarPendente(Buffer.from(JSON.stringify({ state: "s" })).toString("base64url"), APP), null);
  const adulterado = codificarPendente({ ...p, destino: "https://evil.example" });
  assert.equal(decodificarPendente(adulterado, APP)?.destino, "/");
});

test("lerConfigAuth: SSO completo, incompleto, desligado; emergência; modo sem login só fora de produção", () => {
  const base = { HUB_ISSUER: "http://localhost:3040/oidc/", HUB_CLIENT_ID: "hub-5-x", HUB_CLIENT_SECRET: "s", APP_URL: "http://localhost:3160/" };
  const c = lerConfigAuth(base);
  assert.equal(c.hub?.issuer, "http://localhost:3040/oidc");
  assert.equal(c.appUrl, "http://localhost:3160");
  assert.equal(c.hub?.scopes, "openid email profile");
  assert.equal(c.hub?.tokenAuthMethod, "client_secret_basic");
  assert.deepEqual(c.hub?.papeisPermitidos, ["admin"]);
  assert.equal(c.emergencia, null);
  assert.equal(c.sessaoHoras, 12);

  assert.equal(lerConfigAuth({ ...base, HUB_SSO_ENABLED: "false" }).hub, null);
  assert.equal(lerConfigAuth({ ...base, HUB_CLIENT_SECRET: "" }).hub, null);
  assert.equal(lerConfigAuth({ ...base, APP_URL: "" }).hub, null);
  assert.deepEqual(lerConfigAuth({ ...base, HUB_PAPEIS_PERMITIDOS: "Admin, member" }).hub?.papeisPermitidos, ["admin", "member"]);
  assert.equal(lerConfigAuth({ ...base, HUB_TOKEN_AUTH_METHOD: "client_secret_post" }).hub?.tokenAuthMethod, "client_secret_post");
  assert.equal(lerConfigAuth({ ...base, GESTOR_SESSAO_HORAS: "0" }).sessaoHoras, 12);
  assert.equal(lerConfigAuth({ ...base, GESTOR_SESSAO_HORAS: "8" }).sessaoHoras, 8);

  // Emergência só com o flag E as duas chaves.
  assert.equal(lerConfigAuth({ ...base, GESTOR_LOGIN_EMERGENCIA: "true" }).emergencia, null);
  assert.ok(lerConfigAuth({ ...base, GESTOR_LOGIN_EMERGENCIA: "true", GESTOR_EMERGENCIA_SENHA_HASH: "h", GESTOR_EMERGENCIA_TOTP: "abcd efgh" }).emergencia);
  assert.equal(lerConfigAuth({ GESTOR_LOGIN_EMERGENCIA: "true", GESTOR_EMERGENCIA_SENHA_HASH: "h", GESTOR_EMERGENCIA_TOTP: "x" }).emergencia?.totpSecret, "X");

  assert.equal(lerConfigAuth({ GESTOR_AUTH_DESLIGADA: "true" }).desligada, true);
  assert.equal(lerConfigAuth({ GESTOR_AUTH_DESLIGADA: "true", NODE_ENV: "production" }).desligada, false);
});

test("emissorConfere ignora barra final; URLs de cadastro no Hub", () => {
  assert.ok(emissorConfere("http://localhost:3040/oidc/", "http://localhost:3040/oidc"));
  assert.ok(!emissorConfere("https://outro/oidc", "http://localhost:3040/oidc"));
  assert.deepEqual(urlsParaCadastrarNoHub(APP), {
    redirect: `${APP}/auth/callback`,
    initiateLogin: `${APP}/auth/hub/iniciar`,
    backchannel: `${APP}/auth/backchannel-logout`,
    postLogout: `${APP}/auth/saiu`,
  });
});

test("atrás do Nginx a base é o APP_URL, nunca o host interno", () => {
  const req = new Request("http://localhost:3001/auth/callback?code=c&state=s&iss=x");
  assert.equal(basePublica(req, APP), APP);
  assert.equal(urlCallback(req, APP).href, `${APP}/auth/callback?code=c&state=s&iss=x`);
  assert.equal(basePublica(req, ""), "http://localhost:3001");
});

test("avisos: motivo desconhecido cai em 'falha'; todos têm texto", () => {
  assert.equal(motivoValido("desconhecido"), "desconhecido");
  assert.equal(motivoValido("<script>"), "falha");
  assert.equal(motivoValido(undefined), "falha");
  for (const a of Object.values(AVISOS)) assert.ok(a.titulo && a.texto);
  assert.match(AVISOS.desconhecido.texto, /mesmo e-mail do Hub/);
});
