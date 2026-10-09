/**
 * Login único pelo Hub (OIDC) — de onde vem cada ajuste.
 *
 * O Gestor não tem tela de configurações: tudo vem do `.env` (ver `.env.example`, seção
 * "Login único"). Nada fixo em código. Pura (recebe o env), testável sem Next.
 *
 * Modos de acesso, em ordem:
 * 1. `GESTOR_AUTH_DESLIGADA=true` — sem login nenhum. SÓ fora de produção (dev local de outras
 *    telas); em produção é ignorado.
 * 2. SSO ligado (`HUB_SSO_ENABLED` diferente de `false` e emissor + client_id + segredo + APP_URL
 *    preenchidos) — o único jeito normal de entrar. Usuário, senha e 2FA só no Hub.
 * 3. Emergência (`GESTOR_LOGIN_EMERGENCIA=true` + hash da senha + segredo TOTP) — senha + código
 *    daqui, só para o dono, só quando o SSO está desligado ou o Hub está fora do ar. Nunca aparece
 *    como alternativa na tela normal.
 * Sem nenhum dos três: o sistema fica fechado (falha fechada) e mostra "Acesso não configurado".
 */

export type Env = Record<string, string | undefined>;

export type HubSsoConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  /** Método de autenticação no /token, igual ao escolhido no bloco "Login único" do Hub. */
  tokenAuthMethod: "client_secret_basic" | "client_secret_post";
  /** Papéis do Hub (`hub_role`) aceitos. Vazio = qualquer papel (o Hub já filtra quem tem o sistema liberado). */
  papeisPermitidos: string[];
};

export type EmergenciaConfig = {
  senhaHash: string;
  totpSecret: string;
};

export type AuthConfig = {
  /** Base pública do sistema, sem barra no fim (ex.: https://gestor.ifatokun.com.br). */
  appUrl: string;
  /** null = SSO desligado ou incompleto. */
  hub: HubSsoConfig | null;
  /** null = login de emergência desligado (padrão). */
  emergencia: EmergenciaConfig | null;
  /** Só em desenvolvimento: sem login nenhum. */
  desligada: boolean;
  /** Duração da sessão local, em horas. */
  sessaoHoras: number;
  producao: boolean;
};

const sim = (v: string | undefined) => /^(1|true|sim|yes|on)$/i.test((v ?? "").trim());
const nao = (v: string | undefined) => /^(0|false|nao|não|no|off)$/i.test((v ?? "").trim());
const limpa = (v: string | undefined) => (v ?? "").trim();
const semBarraFinal = (v: string) => v.replace(/\/+$/, "");

export function lerConfigAuth(env: Env = process.env): AuthConfig {
  const producao = env.NODE_ENV === "production";
  const appUrl = semBarraFinal(limpa(env.APP_URL));

  const issuer = semBarraFinal(limpa(env.HUB_ISSUER));
  const clientId = limpa(env.HUB_CLIENT_ID);
  const clientSecret = env.HUB_CLIENT_SECRET ?? "";
  const hubLigado = !nao(env.HUB_SSO_ENABLED);
  const hub: HubSsoConfig | null =
    hubLigado && issuer && clientId && clientSecret && appUrl
      ? {
          issuer,
          clientId,
          clientSecret,
          scopes: limpa(env.HUB_SCOPES) || "openid email profile",
          tokenAuthMethod: limpa(env.HUB_TOKEN_AUTH_METHOD) === "client_secret_post" ? "client_secret_post" : "client_secret_basic",
          papeisPermitidos: (env.HUB_PAPEIS_PERMITIDOS ?? "admin")
            .split(",")
            .map((p) => p.trim().toLowerCase())
            .filter(Boolean),
        }
      : null;

  const senhaHash = limpa(env.GESTOR_EMERGENCIA_SENHA_HASH);
  const totpSecret = limpa(env.GESTOR_EMERGENCIA_TOTP).replace(/\s+/g, "").toUpperCase();
  const emergencia = sim(env.GESTOR_LOGIN_EMERGENCIA) && senhaHash && totpSecret ? { senhaHash, totpSecret } : null;

  const horas = Number(limpa(env.GESTOR_SESSAO_HORAS) || "12");
  const sessaoHoras = Number.isFinite(horas) && horas >= 1 && horas <= 24 * 30 ? horas : 12;

  return {
    appUrl,
    hub,
    emergencia,
    desligada: !producao && sim(env.GESTOR_AUTH_DESLIGADA),
    sessaoHoras,
    producao,
  };
}

/** `iss` recebido no início do login (third-party initiated login) bate com o emissor configurado? */
export const emissorConfere = (iss: string, issuer: string): boolean => semBarraFinal(iss.trim()) === issuer;

export const ROTAS_AUTH = {
  /** initiate_login_uri cadastrado no Hub — e a porta de entrada de quem chega sem sessão. */
  iniciar: "/auth/hub/iniciar",
  callback: "/auth/callback",
  backchannel: "/auth/backchannel-logout",
  sair: "/auth/sair",
  /** Para onde o Hub manda depois de "Sair" (página pública, não volta sozinha para o Hub). */
  saiu: "/auth/saiu",
  aviso: "/auth/aviso",
  emergencia: "/auth/emergencia",
} as const;

/** As URLs que o administrador cadastra no bloco "Login único" do sistema no Hub. */
export function urlsParaCadastrarNoHub(appUrl: string) {
  return {
    redirect: `${appUrl}${ROTAS_AUTH.callback}`,
    initiateLogin: `${appUrl}${ROTAS_AUTH.iniciar}`,
    backchannel: `${appUrl}${ROTAS_AUTH.backchannel}`,
    postLogout: `${appUrl}${ROTAS_AUTH.saiu}`,
  };
}
