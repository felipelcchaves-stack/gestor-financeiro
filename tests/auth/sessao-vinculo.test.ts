// Usa o banco descartável `prisma/teste-automatizado.db` criado pelo `npm test` (nunca o dev.db).
import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "../../src/generated/prisma";
import { criarSessao, encerrarSessaoPorToken, encerrarSessoesDoHub, hashToken, limparSessoesVencidas, validarSessao } from "../../src/lib/auth/sessao";
import { resolverUsuarioDoHub, type ClaimsHub } from "../../src/lib/auth/vinculo";

assert.match(process.env.DATABASE_URL ?? "", /teste-automatizado\.db$/, "rode pelo npm test (banco descartável)");
const db = new PrismaClient();
after(() => db.$disconnect());
beforeEach(async () => {
  await db.sessao.deleteMany();
  await db.usuario.deleteMany();
});

const claims = (c: Partial<ClaimsHub> = {}): ClaimsHub => ({
  sub: "7",
  email: "felipe@ifatokun.com.br",
  emailVerificado: true,
  nome: "Felipe",
  papelHub: "admin",
  sid: "sid-a",
  ...c,
});

test("vínculo: primeiro pelo e-mail (grava o sub), depois pelo sub mesmo com e-mail trocado no Hub", async () => {
  const u = await db.usuario.create({ data: { email: "felipe@ifatokun.com.br", nome: "Felipe" } });
  const r1 = await resolverUsuarioDoHub(db, claims({ email: "Felipe@IFATOKUN.com.br" }), ["admin"]);
  assert.deepEqual(r1, { ok: true, usuarioId: u.id, vinculouAgora: true });
  assert.equal((await db.usuario.findUnique({ where: { id: u.id } }))?.hubSub, "7");
  const r2 = await resolverUsuarioDoHub(db, claims({ email: "novo@ifatokun.com.br" }), ["admin"]);
  assert.deepEqual(r2, { ok: true, usuarioId: u.id, vinculouAgora: false });
});

test("vínculo: e-mail desconhecido é recusado e NADA é criado", async () => {
  const r = await resolverUsuarioDoHub(db, claims({ email: "estranho@ifatokun.com.br" }), ["admin"]);
  assert.deepEqual(r, { ok: false, motivo: "desconhecido" });
  assert.equal(await db.usuario.count(), 0);
});

test("vínculo: inativo, conflito de sub, e-mail não verificado e papel fora da lista são recusados", async () => {
  await db.usuario.create({ data: { email: "inativo@ifatokun.com.br", nome: "I", ativo: false } });
  assert.deepEqual(await resolverUsuarioDoHub(db, claims({ email: "inativo@ifatokun.com.br" }), []), { ok: false, motivo: "inativo" });

  await db.usuario.create({ data: { email: "felipe@ifatokun.com.br", nome: "F", hubSub: "99" } });
  assert.deepEqual(await resolverUsuarioDoHub(db, claims(), []), { ok: false, motivo: "conflito" });

  assert.deepEqual(await resolverUsuarioDoHub(db, claims({ emailVerificado: false }), []), { ok: false, motivo: "nao_verificado" });
  assert.deepEqual(await resolverUsuarioDoHub(db, claims({ papelHub: "member" }), ["admin"]), { ok: false, motivo: "papel" });
  // lista vazia = qualquer papel (o Hub já decide quem tem o sistema liberado)
  await db.usuario.create({ data: { email: "membro@ifatokun.com.br", nome: "M" } });
  assert.equal((await resolverUsuarioDoHub(db, claims({ sub: "8", email: "membro@ifatokun.com.br", papelHub: "member" }), [])).ok, true);
});

test("sessão: token só em hash, valida, vence, e some com usuário desativado", async () => {
  const u = await db.usuario.create({ data: { email: "felipe@ifatokun.com.br", nome: "Felipe" } });
  const agora = new Date("2026-10-08T12:00:00Z");
  const { token, expiraEm } = await criarSessao(db, { usuarioId: u.id, origem: "hub", hubSid: "sid-a", hubSub: "7", horas: 12, agora });
  assert.equal(expiraEm.toISOString(), "2026-10-09T00:00:00.000Z");
  const linha = await db.sessao.findFirstOrThrow();
  assert.equal(linha.tokenHash, hashToken(token));
  assert.notEqual(linha.tokenHash, token);

  const v = await validarSessao(db, token, agora);
  assert.equal(v?.usuario.email, "felipe@ifatokun.com.br");
  assert.equal(v?.hubSid, "sid-a");
  assert.equal(await validarSessao(db, "token-errado", agora), null);
  assert.equal(await validarSessao(db, undefined, agora), null);
  assert.equal(await validarSessao(db, token, new Date("2026-10-09T00:00:01Z")), null);
  assert.equal(await db.sessao.count(), 0, "vencida é apagada");

  const s2 = await criarSessao(db, { usuarioId: u.id, origem: "hub", horas: 1, agora });
  await db.usuario.update({ where: { id: u.id }, data: { ativo: false } });
  assert.equal(await validarSessao(db, s2.token, agora), null);
});

test("back-channel: derruba só as sessões do sid; sem sid, todas as do sub abertas pelo Hub", async () => {
  const u = await db.usuario.create({ data: { email: "felipe@ifatokun.com.br", nome: "Felipe", hubSub: "7" } });
  const a = await criarSessao(db, { usuarioId: u.id, origem: "hub", hubSid: "sid-a", hubSub: "7", horas: 1 });
  const b = await criarSessao(db, { usuarioId: u.id, origem: "hub", hubSid: "sid-b", hubSub: "7", horas: 1 });
  const e = await criarSessao(db, { usuarioId: u.id, origem: "emergencia", horas: 1 });

  assert.equal(await encerrarSessoesDoHub(db, { sid: "sid-a", sub: "7" }), 1);
  assert.equal(await validarSessao(db, a.token), null);
  assert.ok(await validarSessao(db, b.token));

  assert.equal(await encerrarSessoesDoHub(db, { sid: null, sub: "7" }), 1);
  assert.equal(await validarSessao(db, b.token), null);
  assert.ok(await validarSessao(db, e.token), "sessão de emergência não é do Hub");
  assert.equal(await encerrarSessoesDoHub(db, { sid: null, sub: null }), 0);

  await encerrarSessaoPorToken(db, e.token);
  assert.equal(await db.sessao.count(), 0);
});

test("limpeza das sessões vencidas", async () => {
  const u = await db.usuario.create({ data: { email: "felipe@ifatokun.com.br", nome: "Felipe" } });
  await criarSessao(db, { usuarioId: u.id, origem: "hub", horas: 1, agora: new Date("2020-01-01") });
  await criarSessao(db, { usuarioId: u.id, origem: "hub", horas: 1 });
  assert.equal(await limparSessoesVencidas(db), 1);
  assert.equal(await db.sessao.count(), 1);
});
