/**
 * Cadastra (ou atualiza) quem pode abrir o Gestor pelo login único do Hub. O login pelo Hub NUNCA
 * cria usuário sozinho: este script é o único caminho.
 *
 *   npm run usuario:criar -- --email felipe@ifatokun.com.br --nome "Felipe Chaves"
 *   npm run usuario:criar -- --email x@ifatokun.com.br --nome "X" --papel equipe
 *   npm run usuario:criar -- --email antigo@gmail.com --novo-email felipe@ifatokun.com.br
 *   npm run usuario:criar -- --email x@ifatokun.com.br --desativar
 *   npm run usuario:criar -- --listar
 *
 * O e-mail precisa ser o MESMO da conta no Hub (o Hub só emite contas @ifatokun.com.br).
 */
import { parseArgs } from "node:util";
import { PrismaClient } from "../src/generated/prisma";
import { normalizarEmail } from "../src/lib/auth/vinculo";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    "novo-email": { type: "string" },
    nome: { type: "string" },
    papel: { type: "string" },
    desativar: { type: "boolean", default: false },
    listar: { type: "boolean", default: false },
  },
});

const prisma = new PrismaClient();

async function main() {
  if (values.listar) {
    const us = await prisma.usuario.findMany({ orderBy: { createdAt: "asc" } });
    for (const u of us) console.log(`${u.email}\t${u.nome}\t${u.papel}\t${u.ativo ? "ativo" : "desativado"}\thub:${u.hubSub ? "vinculado" : "ainda não"}`);
    if (!us.length) console.log("Nenhum usuário cadastrado.");
    return;
  }
  if (!values.email) throw new Error("Informe --email (ou --listar).");
  const email = normalizarEmail(values.email);
  const papel = values.papel ?? "dono";
  if (!["dono", "equipe"].includes(papel)) throw new Error("--papel deve ser dono ou equipe.");
  const existente = await prisma.usuario.findUnique({ where: { email } });

  if (values.desativar) {
    if (!existente) throw new Error(`Usuário ${email} não existe.`);
    await prisma.usuario.update({ where: { id: existente.id }, data: { ativo: false } });
    await prisma.sessao.deleteMany({ where: { usuarioId: existente.id } });
    console.log(`Desativado: ${email} (sessões encerradas).`);
    return;
  }

  if (values["novo-email"]) {
    if (!existente) throw new Error(`Usuário ${email} não existe.`);
    const novo = normalizarEmail(values["novo-email"]);
    // Trocar o e-mail desfaz o vínculo com o Hub: o próximo login refaz pelo e-mail novo.
    await prisma.usuario.update({ where: { id: existente.id }, data: { email: novo, hubSub: null } });
    await prisma.sessao.deleteMany({ where: { usuarioId: existente.id } });
    console.log(`E-mail trocado: ${email} -> ${novo}. Vínculo com o Hub refeito no próximo login.`);
    return;
  }

  if (!email.endsWith("@ifatokun.com.br")) console.warn(`Atenção: o Hub só emite contas @ifatokun.com.br; ${email} nunca vai conseguir entrar pelo Hub.`);
  if (existente) {
    await prisma.usuario.update({ where: { id: existente.id }, data: { nome: values.nome ?? existente.nome, papel, ativo: true } });
    console.log(`Atualizado: ${email} (${papel}).`);
  } else {
    if (!values.nome) throw new Error("Informe --nome para um usuário novo.");
    await prisma.usuario.create({ data: { email, nome: values.nome, papel } });
    console.log(`Criado: ${email} (${papel}). Ele entra pelo Hub com esse mesmo e-mail.`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
