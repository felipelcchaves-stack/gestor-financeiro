/**
 * Gera as variáveis do login de emergência (plano B quando o Hub está fora do ar):
 * hash scrypt da senha + segredo TOTP novo + o link otpauth:// para o app autenticador.
 *
 *   npm run auth:emergencia -- --senha 'uma senha longa'
 *
 * Cole a saída no .env do servidor (nunca no repositório) e ligue GESTOR_LOGIN_EMERGENCIA=true
 * só quando precisar.
 */
import { parseArgs } from "node:util";
import { gerarHashSenha, gerarSegredoTotp } from "../src/lib/auth/emergencia";

const { values } = parseArgs({ options: { senha: { type: "string" }, conta: { type: "string", default: "dono" } } });
const senha = values.senha ?? "";
if (senha.length < 12) {
  console.error("Use --senha com pelo menos 12 caracteres.");
  process.exit(1);
}
const segredo = gerarSegredoTotp();
const otpauth = `otpauth://totp/${encodeURIComponent(`Gestor Financeiro (emergência):${values.conta}`)}?secret=${segredo}&issuer=${encodeURIComponent("Gestor Financeiro")}&algorithm=SHA1&digits=6&period=30`;
console.log(`GESTOR_EMERGENCIA_SENHA_HASH=${gerarHashSenha(senha)}`);
console.log(`GESTOR_EMERGENCIA_TOTP=${segredo}`);
console.log(`# Adicione no app autenticador (ou gere um QR com este link):\n# ${otpauth}`);
