// Conteúdo de ajuda/documentação do sistema, organizado pelos mesmos
// grupos do menu lateral (AppSidebar.tsx) — pra explicar o que cada tela
// faz e como usar, acessível de qualquer lugar pelo botão de ajuda no
// header (HelpSheet.tsx).
//
// Escrito de propósito em linguagem bem simples (nível de explicação
// pra alguém de uns 18 anos, sem experiência com finanças) — nada de
// termo técnico sem explicação ao lado. Se for adicionar uma página
// nova aqui, mantenha esse mesmo nível.

export type PaginaAjuda = {
  titulo: string;
  href: string;
  resumo: string;
  comoUsar: string;
};

export type GrupoAjuda = {
  label: string;
  paginas: PaginaAjuda[];
};

export const AJUDA_CONTEUDO: GrupoAjuda[] = [
  {
    label: "Principal",
    paginas: [
      {
        titulo: "Meu Mapa",
        href: "/",
        resumo:
          "Essa é a tela principal. Ela te diz, em uma frase, o que fazer agora pra sair das dívidas. Uma luz colorida mostra se sua situação está bem (verde), no limite (amarela) ou preocupante (vermelha). Também mostra quanto sobra do seu dinheiro todo mês depois de pagar as contas, e a ordem certa pra ir quitando cada dívida primeiro.",
        comoUsar:
          "Comece sempre por aqui. Clique em \"Resolver agora\" nas ações sugeridas pra ir direto pra tela que resolve aquilo. Uma vez por mês, registre aqui quanto você tem de patrimônio (bens menos dívidas) pra acompanhar se está melhorando.",
      },
      {
        titulo: "Resumo",
        href: "/resumo",
        resumo:
          "Uma versão com todos os números detalhados — quanto você tem, quanto deve em cada dívida, como estão suas metas. É a mesma informação do Meu Mapa, só que sem a parte de \"o que fazer\", pra quem quer só ver os números.",
        comoUsar: "Use quando quiser ver os números exatos, sem a camada de sugestão do Mapa.",
      },
      {
        titulo: "Relatório",
        href: "/relatorio",
        resumo:
          "Uma lista do que fazer na semana ou no mês: a ação mais importante agora (inclusive o que fazer se cair um dinheiro extra na sua mão), como estão suas metas, onde você mais gastou, uma nota de 0 a 100 pra sua saúde financeira, e uma lista do que ainda falta organizar no sistema.",
        comoUsar: "Dê uma olhada aqui uma vez por semana ou no começo do mês. Cada item da lista tem um link direto pra resolver.",
      },
    ],
  },
  {
    label: "Cadastros",
    paginas: [
      {
        titulo: "Passivos",
        href: "/passivos",
        resumo:
          "Aqui você cadastra toda dívida que tem: cartão, empréstimo, financiamento, até uma dívida informal com alguém. É a informação mais importante do sistema — sem cadastrar suas dívidas aqui, nenhuma outra tela consegue calcular nada.",
        comoUsar:
          "Cadastre o nome, o tipo de dívida, quanto falta pra quitar e, se souber, quanto de juro ela cobra por mês. Quanto mais completo, melhor o sistema consegue te ajudar a decidir qual pagar primeiro.",
      },
      {
        titulo: "Ativos",
        href: "/ativos",
        resumo: "Aqui você cadastra o que você TEM (dinheiro guardado, investimento, imóvel etc), não o que deve. Serve pra calcular seu patrimônio de verdade e pra mostrar se algo seu está garantindo alguma dívida.",
        comoUsar: "Cadastre o valor e quanto tempo levaria pra transformar isso em dinheiro na mão. Se esse bem está garantindo alguma dívida, você vincula isso na tela de detalhe dele.",
      },
      {
        titulo: "Metas",
        href: "/metas",
        resumo:
          "Uma meta é tipo \"quero zerar essa dívida até tal data\". O sistema calcula quanto você precisa pagar por mês pra conseguir, e avisa se o ritmo atual está dando conta — mas só depois que você começar a importar e organizar seus extratos ligados a essa meta.",
        comoUsar: "Crie a meta escolhendo a dívida (ou dívidas) e a data que você quer zerar. Sem extrato importado e organizado, a meta fica sem informação pra acompanhar o progresso.",
      },
      {
        titulo: "Contas",
        href: "/contas",
        resumo: "Suas contas bancárias e cartões, com o saldo de cada uma. Também é aqui que você registra se tem cheque especial (um limite extra que o banco libera quando a conta fica negativa, cobrando juro alto por isso).",
        comoUsar: "O saldo atualiza sozinho quando você importa um extrato novo (o sistema encontra a linha de \"saldo do dia\"). Ou você pode editar o saldo na mão ao criar a conta.",
      },
      {
        titulo: "Recorrências",
        href: "/recorrencias",
        resumo:
          "Dinheiro que entra ou sai todo mês do mesmo jeito: salário, aluguel, assinatura de streaming — ou coisas pontuais tipo 13º salário. Essa informação é usada pra calcular quanto sobra do seu dinheiro todo mês (no Meu Mapa) e qual é a ação mais urgente (no Relatório).",
        comoUsar:
          "Cadastre se é uma entrada ou uma saída de dinheiro, se se repete todo mês ou é só uma vez, e se você já tem certeza do valor ou é só uma estimativa. Marque como \"essencial\" as contas que você não pode deixar de pagar. Se parou de pagar alguma coisa por um tempo, desative em vez de excluir, pra não perder o histórico.",
      },
      {
        titulo: "Categorias",
        href: "/categorias",
        resumo: "As \"gavetas\" onde você organiza seus gastos e ganhos (ex: Moradia, Mercado, Salário) — cada categoria pode ter subcategorias dentro dela.",
        comoUsar: "Você pode criar uma categoria nova aqui, ou direto na hora de importar um extrato. Só não dá pra excluir uma categoria se já tiver algo organizado dentro dela.",
      },
    ],
  },
  {
    label: "Ferramentas",
    paginas: [
      {
        titulo: "Comparar estratégias",
        href: "/otimizacao",
        resumo:
          "Mostra, lado a lado, 3 jeitos diferentes de decidir qual dívida pagar primeiro: a que cobra mais juro, a que você quita mais rápido, ou a que libera mais dinheiro no seu bolso todo mês. Um gráfico mostra como sua dívida total vai caindo em cada um dos 3 jeitos, até chegar a zero.",
        comoUsar: "Escolha quais dívidas entram na simulação e quanto de dinheiro extra você tem disponível por mês. O sistema mostra os 3 caminhos — você decide qual seguir.",
      },
      {
        titulo: "Ataque rápido",
        href: "/ataque-rapido",
        resumo: "Foco só nas dívidas pequenas, que ficam incomodando no dia a dia. Mostra de um jeito simples em quanto tempo cada uma delas some, sem a tabela cheia de números da tela \"Comparar estratégias\".",
        comoUsar: "Ajuste quanto dinheiro extra você tem disponível e veja as dívidas pequenas sumindo uma atrás da outra.",
      },
      {
        titulo: "Maiores ofensores",
        href: "/ofensores",
        resumo: "Mostra em que você mais está gastando dinheiro, categoria por categoria (e dentro de cada uma, por subcategoria). Também deixa você definir um limite de gasto mensal por categoria, pra acompanhar se está estourando.",
        comoUsar: "Escolha o período (mês, trimestre, ano) pra ver o ranking. Defina um limite mensal numa categoria pra acompanhar o quanto já foi usado dele.",
      },
      {
        titulo: "Consultor",
        href: "/consultor",
        resumo:
          "Uma calculadora (sem inteligência artificial, sem custo nenhum) que olha cada uma das suas dívidas e diz: vale mais a pena quitar essa agora, ou pagar só o mínimo dela e guardar o resto do dinheiro? Ela leva em conta se você tem uma reserva de emergência, quanto sobra do seu dinheiro por mês, e se algum cartão tem cheque especial. Também dá uma nota de 0 a 100 pra sua saúde financeira e simula \"e se eu recebesse um dinheiro extra\" ou \"e se eu pagasse essa dívida à vista com desconto\".",
        comoUsar:
          "Informe uma taxa de referência do mercado (por exemplo, quanto rende a poupança ou um investimento seguro) pra comparar com o juro de cada dívida sua. Use os simuladores pra testar cenários do tipo \"e se...\".",
      },
      {
        titulo: "Limite de cartão",
        href: "/limite-cartao",
        resumo:
          "Compara, cartão por cartão, quanto você gasta por mês só com contas que não pode deixar de pagar (marcadas como \"essencial\") com o limite de crédito que você tem liberado nesse cartão — pra você saber se dá pra pedir uma redução de limite sem risco de travar algum pagamento importante.",
        comoUsar:
          "Marque as contas essenciais na tela de Recorrências (ou direto na hora de importar um extrato) e associe cada uma ao cartão certo. Depois, informe aqui o limite atual de cada cartão pra ver a comparação.",
      },
      {
        titulo: "Cartões",
        href: "/cartoes",
        resumo:
          "Mostra, cartão por cartão, quanto você tem gastado ao longo dos meses, com uma estimativa de quanto deve vir nos próximos meses seguindo esse mesmo ritmo. Também mostra o quanto você já gastou nesse cartão neste mês perto de uma meta que você definir, e as compras parceladas que ainda vão cobrar nos próximos meses.",
        comoUsar: "Acompanhe aqui se algum cartão está com o gasto subindo. Defina uma meta de gasto mensal pra cada cartão se quiser se controlar melhor.",
      },
      {
        titulo: "Cofre",
        href: "/cofre",
        resumo:
          "Um jeito de separar automaticamente uma parte do seu salário (ou de outra entrada de dinheiro) pra uma conta específica, só pra usar em quitar dívida — assim esse dinheiro não se mistura com o resto e não é gasto por engano com outra coisa.",
        comoUsar: "Configure qual % do seu ganho deve ser separado e pra qual conta. A tela mostra quanto já foi separado de fato até agora, e pode te dar uma sugestão (com IA) de meta ou de onde cortar gasto pra separar mais rápido.",
      },
    ],
  },
  {
    label: "Dados",
    paginas: [
      {
        titulo: "Transações",
        href: "/transacoes",
        resumo: "A lista de tudo que já entrou ou saiu do seu bolso — seja importado do banco ou digitado na mão. Dá pra filtrar por tipo (ganho/gasto) e por categoria, e ordenar por data ou por valor.",
        comoUsar:
          "Clique em \"ver\" numa linha pra abrir e poder mudar a categoria, o valor ou a data, ou até excluir. Você também pode selecionar várias linhas de uma vez e organizar todas juntas.",
      },
      {
        titulo: "Importar",
        href: "/importar",
        resumo:
          "A porta de entrada pras 3 formas de trazer suas movimentações pro sistema: extrato do banco em PDF (o sistema lê e você confirma cada linha), fatura de cartão em PDF (o sistema pega o total, o mínimo e a data de vencimento) e foto/print de um comprovante (você digita tudo na mão).",
        comoUsar:
          "No extrato: confira cada linha antes de confirmar — você pode organizar várias de uma vez ou deixar sem categoria e resolver depois em Transações. Nada é salvo até você clicar em confirmar.",
      },
      {
        titulo: "Documentos",
        href: "/documentos",
        resumo: "Todo PDF ou imagem que você já importou fica guardado aqui, com uma prévia pra visualizar e a lista de onde cada um foi usado.",
        comoUsar: "Clique em \"ver\" pra abrir a prévia do arquivo e ver a quais transações ou dívidas ele está ligado.",
      },
      {
        titulo: "Relatório por categoria",
        href: "/relatorio/categorias",
        resumo: "Mostra quanto você ganhou e gastou em cada categoria, num período que você escolhe — pra te ajudar a achar onde cortar gasto e sobrar mais dinheiro pra pagar dívida.",
        comoUsar: "Escolha o período (esse mês, trimestre, ano, ou tudo) e, se quiser, marque só as categorias que te interessam pra ver o total só delas.",
      },
    ],
  },
  {
    label: "Outros",
    paginas: [
      {
        titulo: "Assistente de configuração",
        href: "/comecar",
        resumo: "Um passo a passo guiado pra cadastrar tudo pela primeira vez: conta → dívidas → bens → meta → quanto você consegue separar por mês → um resumo final. Usa as mesmas telas de cadastro normais, só que em ordem.",
        comoUsar: "Use na primeira vez que for organizar suas finanças no sistema, ou sempre que quiser recomeçar do zero de forma guiada. Dá pra pular qualquer etapa e voltar nela depois.",
      },
    ],
  },
];
