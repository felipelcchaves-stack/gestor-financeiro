"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lerConfigAuth, ROTAS_AUTH } from "@/lib/auth/config";
import { nomeCookieSessao, opcoesCookieSessao } from "@/lib/auth/cookies";
import { destinoSeguro } from "@/lib/auth/destino";
import { bloqueado, conferirSenha, conferirTotp, limparFalhas, registrarFalha } from "@/lib/auth/emergencia";
import { configHub } from "@/lib/auth/hub";
import { criarSessao } from "@/lib/auth/sessao";

const voltar = (erro: string): never => redirect(`${ROTAS_AUTH.emergencia}?erro=${erro}`);

/**
 * Login de emergência: senha + código do app autenticador (do .env), só para o dono. Recusado se
 * a emergência estiver desligada, ou se o SSO estiver ligado e o Hub responder (aí o caminho é o Hub).
 */
export async function entrarEmergencia(form: FormData): Promise<void> {
  const cfg = lerConfigAuth();
  if (!cfg.emergencia) redirect(ROTAS_AUTH.iniciar);
  const emergencia = cfg.emergencia!;
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (bloqueado(ip)) voltar("bloqueado");

  if (cfg.hub) {
    const hubNoAr = await configHub(cfg.hub).then(
      () => true,
      () => false,
    );
    if (hubNoAr) voltar("hub_no_ar");
  }

  const senha = String(form.get("senha") ?? "");
  const codigo = String(form.get("codigo") ?? "");
  const senhaOk = conferirSenha(senha, emergencia.senhaHash);
  const codigoOk = conferirTotp(codigo, emergencia.totpSecret);
  if (!senhaOk || !codigoOk) {
    registrarFalha(ip);
    console.warn(`[auth] emergência: tentativa recusada de ${ip}`);
    voltar("invalido");
  }

  const dono = await prisma.usuario.findFirst({ where: { papel: "dono", ativo: true }, orderBy: { createdAt: "asc" } });
  if (!dono) voltar("sem_dono");
  limparFalhas(ip);
  const sessao = await criarSessao(prisma, { usuarioId: dono!.id, origem: "emergencia", horas: Math.min(cfg.sessaoHoras, 4) });
  (await cookies()).set(nomeCookieSessao(), sessao.token, opcoesCookieSessao(sessao.expiraEm));
  console.warn(`[auth] emergência: sessão aberta para ${dono!.email} (${ip})`);
  redirect(destinoSeguro(String(form.get("destino") ?? "/"), cfg.appUrl || "http://localhost"));
}
