import { test } from "node:test";
import assert from "node:assert/strict";
import {
  base32Decode,
  base32Encode,
  bloqueado,
  codigoTotp,
  contadorTotpAceito,
  ipsGuardados,
  MAX_IPS_GUARDADOS,
  zerarLimites,
  conferirSenha,
  conferirTotp,
  gerarHashSenha,
  gerarSegredoTotp,
  limparFalhas,
  registrarFalha,
} from "../../src/lib/auth/emergencia";

test("senha: hash scrypt confere só com a senha certa e não tem '$'", () => {
  const h = gerarHashSenha("senha de emergência longa");
  assert.ok(!h.includes("$"));
  assert.ok(conferirSenha("senha de emergência longa", h));
  assert.ok(!conferirSenha("outra senha", h));
  assert.ok(!conferirSenha("x", "lixo"));
  assert.ok(!conferirSenha("x", "scrypt:99999999:8:1:aa:bb"));
});

test("TOTP: vetor da RFC 6238 (SHA-1) e janela de ±30 s", () => {
  const segredo = base32Encode(Buffer.from("12345678901234567890"));
  assert.equal(segredo, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(codigoTotp(segredo, 59_000), "287082");
  assert.equal(codigoTotp(segredo, 1111111109_000), "081804");
  assert.ok(conferirTotp("287082", segredo, 59_000));
  assert.ok(conferirTotp("287 082", segredo, 59_000 + 30_000));
  assert.ok(!conferirTotp("287082", segredo, 59_000 + 120_000));
  assert.ok(!conferirTotp("abc", segredo, 59_000));
  assert.deepEqual(base32Decode(segredo), Buffer.from("12345678901234567890"));
  assert.equal(gerarSegredoTotp().length, 32);
});

test("TOTP: devolve o contador aceito e recusa reuso (contador <= último aceito)", () => {
  const segredo = base32Encode(Buffer.from("12345678901234567890"));
  const agora = 59_000; // contador 1
  assert.equal(contadorTotpAceito("287082", segredo, agora), 1);
  assert.equal(contadorTotpAceito("287082", segredo, agora, 1), null, "mesmo código de novo");
  assert.equal(contadorTotpAceito("287082", segredo, agora + 30_000, 1), null, "dentro da janela, ainda recusado");
  const proximo = codigoTotp(segredo, 60_000); // contador 2
  assert.equal(contadorTotpAceito(proximo, segredo, agora, 1), 2);
});

test("limite de tentativas: 5 erros por IP em 15 minutos", () => {
  zerarLimites();
  const ip = "203.0.113.9";
  for (let i = 0; i < 4; i++) registrarFalha(ip, 1000);
  assert.ok(!bloqueado(ip, 1000));
  registrarFalha(ip, 1000);
  assert.ok(bloqueado(ip, 2000));
  assert.ok(!bloqueado("198.51.100.1", 2000), "outro IP segue livre");
  assert.ok(!bloqueado(ip, 1000 + 16 * 60_000));
  limparFalhas(ip);
  zerarLimites();
});

test("limite global: 20 erros espalhados em vários IPs bloqueiam todo mundo", () => {
  zerarLimites();
  for (let i = 0; i < 20; i++) registrarFalha(`10.0.0.${i}`, 1000);
  assert.ok(bloqueado("192.0.2.77", 2000), "IP novo também bloqueado");
  assert.ok(!bloqueado("192.0.2.77", 1000 + 16 * 60_000), "libera depois da janela");
  zerarLimites();
});

test("mapa de IPs tem tamanho máximo", () => {
  zerarLimites();
  for (let i = 0; i < MAX_IPS_GUARDADOS + 500; i++) registrarFalha(`ip-${i}`, 1000 + i * 2000);
  assert.ok(ipsGuardados() <= MAX_IPS_GUARDADOS);
  zerarLimites();
});
