// Textos da tela /auth/aviso (pt-BR, frases curtas). Não revelam nada além do que a pessoa já sabe.
import type { MotivoRecusa } from "./vinculo";

export type MotivoAviso = MotivoRecusa | "negado" | "expirado" | "falha" | "emissor" | "nao_configurado";

export const AVISOS: Record<MotivoAviso, { titulo: string; texto: string; tentarDeNovo: boolean }> = {
  desconhecido: {
    titulo: "Seu usuário não está cadastrado aqui",
    texto: "Você entrou no Hub, mas o seu e-mail ainda não tem acesso ao Gestor Financeiro. Peça ao Felipe para cadastrar você com o mesmo e-mail do Hub.",
    tentarDeNovo: false,
  },
  inativo: { titulo: "Acesso desativado", texto: "Seu acesso ao Gestor Financeiro está desativado. Fale com o Felipe.", tentarDeNovo: false },
  conflito: {
    titulo: "Conta já ligada a outra pessoa",
    texto: "Este usuário do Gestor já está ligado a outra conta do Hub. Fale com o Felipe.",
    tentarDeNovo: false,
  },
  nao_verificado: { titulo: "E-mail não confirmado", texto: "O Hub não confirmou o seu e-mail. Entre no Hub e tente de novo.", tentarDeNovo: true },
  papel: {
    titulo: "Sem permissão",
    texto: "Seu perfil no Hub não pode abrir o Gestor Financeiro. Fale com o Felipe.",
    tentarDeNovo: false,
  },
  negado: {
    titulo: "O Hub não liberou a entrada",
    texto: "Confira se o Gestor Financeiro está liberado para você no Hub.",
    tentarDeNovo: true,
  },
  expirado: { titulo: "A entrada demorou demais", texto: "O pedido de entrada venceu ou foi aberto em outra aba. Tente de novo.", tentarDeNovo: true },
  falha: { titulo: "Não deu para falar com o Hub", texto: "O Hub não respondeu agora. Tente de novo em alguns minutos.", tentarDeNovo: true },
  emissor: {
    titulo: "Pedido de outro lugar",
    texto: "O pedido de entrada veio de um Hub diferente do configurado aqui. Abra o Gestor pelo Hub da Ifatokun.",
    tentarDeNovo: true,
  },
  nao_configurado: {
    titulo: "Acesso não configurado",
    texto: "O login único pelo Hub ainda não foi configurado neste servidor. Por segurança, o sistema fica fechado até isso ser feito.",
    tentarDeNovo: false,
  },
};

export function motivoValido(m: string | undefined | null): MotivoAviso {
  return m && m in AVISOS ? (m as MotivoAviso) : "falha";
}
