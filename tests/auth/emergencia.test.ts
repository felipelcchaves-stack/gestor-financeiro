import { test } from "node:test";
import assert from "node:assert/strict";
import {
  base32Decode,
  base32Encode,
  bloqueado,
  codigoTotp,
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

test("limite de tentativas: 5 erros por IP em 15 minutos", () => {
  const ip = "203.0.113.9";
  limparFalhas(ip);
  for (let i = 0; i < 4; i++) registrarFalha(ip, 1000);
  assert.ok(!bloqueado(ip, 1000));
  registrarFalha(ip, 1000);
  assert.ok(bloqueado(ip, 2000));
  assert.ok(!bloqueado(ip, 1000 + 16 * 60_000));
  limparFalhas(ip);
});
