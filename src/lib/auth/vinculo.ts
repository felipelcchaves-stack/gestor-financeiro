/**
 * De pessoa do Hub para usuário do Gestor (decisão registrada no ROADMAP, "Login único pelo Hub").
 *
 * - Vínculo pelo `sub` do Hub (estável, nunca reaproveitado). Na primeira vez, pelo e-mail: o
 *   usuário com aquele e-mail recebe o `sub`. Depois disso, trocar o e-mail no Hub não quebra nada.
 * - E-mail desconhecido: RECUSADO com mensagem clara. Nunca cria usuário (muito menos dono): o
 *   sistema guarda finanças pessoais e só entra quem foi cadastrado à mão (`npm run usuario:criar`).
 * - Usuário desativado, `sub` em conflito, e-mail não verificado ou papel do Hub fora de
 *   `HUB_PAPEIS_PERMITIDOS`: recusado.
 */
import type { Db } from "./sessao";

export type ClaimsHub = { sub: string; email: string; emailVerificado: boolean; nome: string; papelHub: string; sid: string };

export type MotivoRecusa = "desconhecido" | "inativo" | "conflito" | "nao_verificado" | "papel";

export type ResultadoVinculo = { ok: true; usuarioId: string; vinculouAgora: boolean } | { ok: false; motivo: MotivoRecusa };

export const normalizarEmail = (e: string) => e.trim().toLowerCase();

export async function resolverUsuarioDoHub(db: Db, claims: ClaimsHub, papeisPermitidos: string[]): Promise<ResultadoVinculo> {
  if (!claims.emailVerificado) return { ok: false, motivo: "nao_verificado" };
  if (papeisPermitidos.length > 0 && !papeisPermitidos.includes(claims.papelHub.toLowerCase())) return { ok: false, motivo: "papel" };

  const porSub = await db.usuario.findUnique({ where: { hubSub: claims.sub } });
  if (porSub) return porSub.ativo ? { ok: true, usuarioId: porSub.id, vinculouAgora: false } : { ok: false, motivo: "inativo" };

  const porEmail = await db.usuario.findUnique({ where: { email: normalizarEmail(claims.email) } });
  if (!porEmail) return { ok: false, motivo: "desconhecido" };
  if (!porEmail.ativo) return { ok: false, motivo: "inativo" };
  if (porEmail.hubSub && porEmail.hubSub !== claims.sub) return { ok: false, motivo: "conflito" };
  // Condicional: duas entradas ao mesmo tempo nunca gravam `sub` diferentes.
  const r = await db.usuario.updateMany({ where: { id: porEmail.id, hubSub: null }, data: { hubSub: claims.sub } });
  if (r.count === 0) return { ok: false, motivo: "conflito" };
  return { ok: true, usuarioId: porEmail.id, vinculouAgora: true };
}
