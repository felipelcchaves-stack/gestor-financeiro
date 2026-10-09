"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lerConfigAuth, ROTAS_AUTH } from "@/lib/auth/config";
import { nomeCookieSessao, opcoesCookieSessao } from "@/lib/auth/cookies";
import { destinoSeguro } from "@/lib/auth/destino";
import { bloqueado, conferirSenha, contadorTotpAceito, limparFalhas, registrarFalha } from "@/lib/auth/emergencia";
import { hubRespondeAgora } from "@/lib/auth/hub";
import { ipDoCliente } from "@/lib/auth/http";
import { consumirContadorEmergencia, criarSessao, ultimoContadorEmergencia } from "@/lib/auth/sessao";

const voltar = (erro: string): never => redirect(`${ROTAS_AUTH.emergencia}?erro=${erro}`);

/**
 * Login de emergência: senha + código do app autenticador (do .env), só para o dono. Recusado se
 * a emergência estiver desligada, ou se o SSO estiver ligado e o Hub responder (aí o caminho é o Hub).
 */
export async function entrarEmergencia(form: FormData): Promise<void> {
  const cfg = lerConfigAuth();
  if (!cfg.emergencia) redirect(ROTAS_AUTH.iniciar);
  const emergencia = cfg.emergencia!;
  const ip = ipDoCliente(await headers());
  if (bloqueado(ip)) voltar("bloqueado");

  // Checagem nova (sem cache) e curta: com o Hub no ar, o caminho é o Hub.
  if (cfg.hub && (await hubRespondeAgora(cfg.hub))) voltar("hub_no_ar");

  const senha = String(form.get("senha") ?? "");
  const codigo = String(form.get("codigo") ?? "");
  const senhaOk = conferirSenha(senha, emergencia.senhaHash);
  const contador = contadorTotpAceito(codigo, emergencia.totpSecret, Date.now(), await ultimoContadorEmergencia(prisma));
  // Código já usado (mesmo dentro da janela de ±30 s) não vale de novo.
  const codigoOk = senhaOk && contador !== null && (await consumirContadorEmergencia(prisma, contador));
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
