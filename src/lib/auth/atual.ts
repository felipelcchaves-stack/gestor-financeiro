/**
 * Cola com o Next: sessão da requisição atual. Toda página do painel (layout de `(painel)`), toda
 * Server Action e toda rota de API privada passam por aqui — o proxy.ts é só a primeira barreira.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lerConfigAuth, ROTAS_AUTH } from "./config";
import { nomeCookieSessao, validarSessao, type SessaoValida } from "./sessao";

/** Usuário fictício só para `GESTOR_AUTH_DESLIGADA=true` fora de produção. */
const SESSAO_DEV: SessaoValida = {
  id: "dev",
  origem: "dev",
  hubSid: null,
  expiraEm: new Date(8640000000000000),
  usuario: { id: "dev", email: "dev@localhost", nome: "Desenvolvimento (sem login)", papel: "dono" },
};

export const obterSessaoAtual = cache(async (): Promise<SessaoValida | null> => {
  if (lerConfigAuth().desligada) return SESSAO_DEV;
  const jar = await cookies();
  return validarSessao(prisma, jar.get(nomeCookieSessao())?.value);
});

/** Páginas: sem sessão, vai para o Hub (pela rota de início) e volta logado. */
export async function exigirSessao(): Promise<SessaoValida> {
  const s = await obterSessaoAtual();
  if (!s) redirect(ROTAS_AUTH.iniciar);
  return s;
}

/** Server Actions: mesma regra (o redirect dentro de uma action leva o navegador para o Hub). */
export async function exigirSessaoAcao(): Promise<SessaoValida> {
  return exigirSessao();
}
