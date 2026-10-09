/**
 * Login de emergência (plano B, desligado por padrão): senha + código do app autenticador, só para
 * o dono, só com `GESTOR_LOGIN_EMERGENCIA=true` e apenas quando o SSO está desligado ou o Hub está
 * fora do ar. Senha e segredo TOTP ficam no `.env` (não no banco): com o Hub caído ninguém entraria
 * para mudá-los numa tela. Gerar com `npm run auth:emergencia`.
 *
 * Senha: scrypt (node:crypto), formato `scrypt:N:r:p:salt:hash` (base64url; sem `$`, porque o .env do Next expande `$VAR`).
 * TOTP: RFC 6238, SHA-1, 30 s, 6 dígitos, tolerância de ±1 janela.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;

export function gerarHashSenha(senha: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(senha.normalize("NFKC"), salt, 32, { N, r: R, p: P });
  return `scrypt:${N}:${R}:${P}:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

export function conferirSenha(senha: string, guardado: string): boolean {
  const partes = guardado.split(":");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [n, r, p] = partes.slice(1, 4).map(Number);
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0) || n > 1 << 20) return false;
  try {
    const salt = Buffer.from(partes[4], "base64url");
    const esperado = Buffer.from(partes[5], "base64url");
    const obtido = scryptSync(senha.normalize("NFKC"), salt, esperado.length, { N: n, r, p, maxmem: 256 * 1024 * 1024 });
    return esperado.length > 0 && timingSafeEqual(obtido, esperado);
  } catch {
    return false;
  }
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(s: string): Buffer {
  const limpo = s.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let valor = 0;
  const out: number[] = [];
  for (const ch of limpo) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("base32 inválido");
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let valor = 0;
  let out = "";
  for (const b of buf) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(valor << (5 - bits)) & 31];
  return out;
}

export function codigoTotp(segredoBase32: string, momentoMs = Date.now(), passo = 30): string {
  const contador = Math.floor(momentoMs / 1000 / passo);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(contador));
  const h = createHmac("sha1", base32Decode(segredoBase32)).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/**
 * Confere o código (±1 janela de 30 s) e devolve o contador TOTP que bateu, ou null. Quem chama
 * guarda o último contador aceito e recusa qualquer um <= ele (um código nunca vale duas vezes).
 */
export function contadorTotpAceito(codigo: string, segredoBase32: string, momentoMs = Date.now(), ultimoAceito: number | null = null): number | null {
  const c = codigo.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const atual = Math.floor(momentoMs / 30_000);
  for (const delta of [-1, 0, 1]) {
    const contador = atual + delta;
    if (ultimoAceito !== null && contador <= ultimoAceito) continue;
    const esperado = codigoTotp(segredoBase32, contador * 30_000);
    if (timingSafeEqual(Buffer.from(esperado), Buffer.from(c))) return contador;
  }
  return null;
}

export function conferirTotp(codigo: string, segredoBase32: string, momentoMs = Date.now()): boolean {
  return contadorTotpAceito(codigo, segredoBase32, momentoMs) !== null;
}

export const gerarSegredoTotp = () => base32Encode(randomBytes(20));

/**
 * Limite em memória: 5 erros por IP e 20 erros no total (todos os IPs juntos) a cada 15 minutos.
 * O limite global segura quem troca de IP; o mapa tem tamanho máximo (as entradas vencidas saem
 * primeiro, depois as mais antigas), então não cresce sem fim.
 */
const tentativas = new Map<string, { n: number; desde: number }>();
const JANELA_MS = 15 * 60_000;
const MAX_POR_IP = 5;
const MAX_GLOBAL = 20;
export const MAX_IPS_GUARDADOS = 1000;
let global: { n: number; desde: number } = { n: 0, desde: 0 };

export function bloqueado(ip: string, agora = Date.now()): boolean {
  if (agora - global.desde <= JANELA_MS && global.n >= MAX_GLOBAL) return true;
  const t = tentativas.get(ip);
  if (!t || agora - t.desde > JANELA_MS) return false;
  return t.n >= MAX_POR_IP;
}

function abrirEspaco(agora: number): void {
  if (tentativas.size < MAX_IPS_GUARDADOS) return;
  for (const [k, v] of tentativas) if (agora - v.desde > JANELA_MS) tentativas.delete(k);
  // Map mantém ordem de inserção: o primeiro é o mais antigo.
  while (tentativas.size >= MAX_IPS_GUARDADOS) tentativas.delete(tentativas.keys().next().value as string);
}

export function registrarFalha(ip: string, agora = Date.now()): void {
  if (agora - global.desde > JANELA_MS) global = { n: 1, desde: agora };
  else global.n += 1;
  const t = tentativas.get(ip);
  if (!t || agora - t.desde > JANELA_MS) {
    tentativas.delete(ip);
    abrirEspaco(agora);
    tentativas.set(ip, { n: 1, desde: agora });
  } else t.n += 1;
}

export const limparFalhas = (ip: string) => void tentativas.delete(ip);

/** Só para testes. */
export function zerarLimites(): void {
  tentativas.clear();
  global = { n: 0, desde: 0 };
}

export const ipsGuardados = () => tentativas.size;
