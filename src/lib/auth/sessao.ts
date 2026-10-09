/**
 * Sessões locais. O cookie leva um token aleatório de 32 bytes; o banco guarda só o SHA-256 dele
 * (vazar o banco não entrega sessões). Cada sessão aberta pelo Hub guarda o `sid` do SSO, que é o
 * que o logout por back-channel usa para derrubá-la.
 */
import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma";

export type Db = PrismaClient;

export const SESSAO_COOKIE_DEV = "gestor_sessao";
/** Em produção o prefixo __Host- exige Secure, Path=/ e nenhum Domain: o cookie nunca vaza para outro subdomínio. */
export const SESSAO_COOKIE_PROD = "__Host-gestor_sessao";
export const nomeCookieSessao = (producao = process.env.NODE_ENV === "production") => (producao ? SESSAO_COOKIE_PROD : SESSAO_COOKIE_DEV);

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type UsuarioDaSessao = { id: string; email: string; nome: string; papel: string };
export type SessaoValida = { id: string; origem: string; hubSid: string | null; expiraEm: Date; usuario: UsuarioDaSessao };

export async function criarSessao(
  db: Db,
  i: { usuarioId: string; origem: "hub" | "emergencia"; hubSid?: string | null; hubSub?: string | null; horas: number; agora?: Date },
): Promise<{ token: string; expiraEm: Date }> {
  const agora = i.agora ?? new Date();
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(agora.getTime() + i.horas * 3600_000);
  await db.sessao.create({
    data: { tokenHash: hashToken(token), usuarioId: i.usuarioId, origem: i.origem, hubSid: i.hubSid ?? null, hubSub: i.hubSub ?? null, expiraEm, createdAt: agora },
  });
  await db.usuario.update({ where: { id: i.usuarioId }, data: { ultimoAcessoEm: agora } });
  return { token, expiraEm };
}

/** Sessão válida (existe, não venceu, usuário ativo) para o token do cookie, ou null. */
export async function validarSessao(db: Db, token: string | undefined | null, agora = new Date()): Promise<SessaoValida | null> {
  if (!token || token.length > 200) return null;
  const s = await db.sessao.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { select: { id: true, email: true, nome: true, papel: true, ativo: true } } },
  });
  if (!s) return null;
  if (s.expiraEm <= agora || !s.usuario.ativo) {
    await db.sessao.deleteMany({ where: { id: s.id } });
    return null;
  }
  const { ativo: _ativo, ...usuario } = s.usuario;
  void _ativo;
  return { id: s.id, origem: s.origem, hubSid: s.hubSid, expiraEm: s.expiraEm, usuario };
}

export async function encerrarSessaoPorToken(db: Db, token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.sessao.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/**
 * Back-channel: apaga as sessões daquele `sid` do Hub. Sem `sid` (a especificação permite só `sub`),
 * apaga todas as sessões abertas pelo Hub para aquele `sub`. Devolve quantas foram encerradas.
 */
export async function encerrarSessoesDoHub(db: Db, alvo: { sid: string | null; sub: string | null }): Promise<number> {
  if (alvo.sid) return (await db.sessao.deleteMany({ where: { hubSid: alvo.sid } })).count;
  if (alvo.sub) return (await db.sessao.deleteMany({ where: { origem: "hub", hubSub: alvo.sub } })).count;
  return 0;
}

/** Limpeza oportunista das vencidas (chamada a cada login). */
export async function limparSessoesVencidas(db: Db, agora = new Date()): Promise<number> {
  return (await db.sessao.deleteMany({ where: { expiraEm: { lte: agora } } })).count;
}
