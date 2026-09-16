// Conteúdo de ajuda/documentação do sistema, organizado pelos mesmos
// grupos do menu lateral (AppSidebar.tsx) — pra explicar o que cada tela
// faz e como usar, acessível de qualquer lugar pelo botão de ajuda no
// header (HelpSheet.tsx).

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
          "Tela inicial — não é um dashboard de números, é a rota de saída: a frase-guia do que você deve hoje, o sinal de rota (verde/amarelo/vermelho), a margem livre mensal, até 3 próximas ações e a trilha visual das dívidas na ordem recomendada de ataque.",
        comoUsar:
          "Comece por aqui sempre. Clique em \"Resolver agora\" nas próximas ações pra ir direto pra tela que resolve a pendência. Registre o patrimônio do mês aqui pra alimentar o termômetro de tendência.",
      },
      {
        titulo: "Resumo",
        href: "/resumo",
        resumo:
          "Dashboard técnico com os números completos — patrimônio, totais por estrutura de dívida, progresso das metas — pra quem quer ver o detalhe além da linguagem simples do Mapa.",
        comoUsar: "Use quando quiser os números exatos sem a camada de \"o que fazer\" do Mapa.",
      },
      {
        titulo: "Relatório",
        href: "/relatorio",
        resumo:
          "Mapa de ações semanal/mensal: a ação prioritária do momento (inclusive o que fazer se aparecer dinheiro pontual), progresso das metas, maiores ofensores do mês, score de saúde financeira e um checklist consolidado de pendências.",
        comoUsar:
          "Revise semanalmente ou no início do mês. Os itens do checklist têm link direto pra tela que resolve cada um.",
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
          "Toda dívida que você tem — cartão, empréstimo, financiamento, até dívida informal. É o dado-base de tudo: sem passivo cadastrado, nenhuma outra tela consegue calcular nada.",
        comoUsar:
          "Cadastre nome, tipo, estrutura (amortiza normal / só juros sem amortização / sem juros), saldo de quitação e, se souber, a taxa de juro mensal — o Consultor e o Comparar estratégias dependem dela.",
      },
      {
        titulo: "Ativos",
        href: "/ativos",
        resumo: "Bens e reservas — o que você tem, não o que deve. Usado pra calcular patrimônio líquido e pra vincular como garantia de algum passivo.",
        comoUsar: "Cadastre valor e liquidez (ex: D+0, D+30). Vincule a um passivo na tela de detalhe do ativo se ele for garantia de alguma dívida.",
      },
      {
        titulo: "Metas",
        href: "/metas",
        resumo:
          "Um objetivo do tipo \"zerar tal dívida até tal data\". O sistema calcula o ritmo necessário e avisa se o ritmo atual é suficiente, uma vez que haja lançamentos importados classificados como alocação dessa meta.",
        comoUsar: "Crie vinculando a um ou mais passivos e uma data-alvo. Sem extrato importado e classificado pra essa meta, o progresso fica sem dado de acompanhamento.",
      },
      {
        titulo: "Contas",
        href: "/contas",
        resumo: "Contas bancárias/cartão — saldo atual, e os campos de cheque especial (limite, taxa, carência) usados pelos alertas de risco.",
        comoUsar: "O saldo é atualizado automaticamente ao importar um extrato (detecta a linha \"saldo do dia\"), ou editável na hora de criar a conta.",
      },
      {
        titulo: "Recorrências",
        href: "/recorrencias",
        resumo:
          "Entradas e despesas que se repetem todo mês (salário, aluguel, assinaturas) ou pontuais (13º, restituição, campanha). Alimentam a Margem Livre do Mapa e a Ação Prioritária do Relatório.",
        comoUsar:
          "Cadastre com tipo (despesa/entrada), frequência (mensal ou única) e confiabilidade (confirmado/estimado). Marque \"essencial\" e associe a um cartão pra alimentar a tela de Limite de cartão. Desative em vez de excluir se parou temporariamente, pra manter o histórico.",
      },
      {
        titulo: "Categorias",
        href: "/categorias",
        resumo: "Árvore de categorias (raiz + subcategoria) usada pra classificar transações, orçamentos e recorrências.",
        comoUsar: "Crie categorias novas aqui ou direto durante a importação de extrato. Excluir só é permitido se não houver nada vinculado.",
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
          "Simula 3 critérios de ordem de ataque às dívidas (menor juro total, menor tempo, maior alívio de caixa) lado a lado, com gráfico de projeção mês a mês do saldo total caindo até zerar.",
        comoUsar: "Selecione os passivos a incluir e o aporte mensal extra disponível. O sistema mostra o trade-off — a escolha final é sua.",
      },
      {
        titulo: "Ataque rápido",
        href: "/ataque-rapido",
        resumo: "Foco só nas dívidas pequenas que sugam caixa no dia a dia — resposta simples de \"em quanto tempo essa aqui vira pó\", sem a tabela técnica completa.",
        comoUsar: "Ajuste o aporte disponível e veja o efeito dominó das dívidas pequenas fechando em sequência.",
      },
      {
        titulo: "Maiores ofensores",
        href: "/ofensores",
        resumo: "Ranking de gastos por categoria (com detalhamento por subcategoria) e orçamento por categoria com acompanhamento de uso mensal.",
        comoUsar: "Alterne entre mês/trimestre/ano. Defina um limite mensal por categoria pra acompanhar o quanto já foi usado.",
      },
      {
        titulo: "Consultor",
        href: "/consultor",
        resumo:
          "Motor de regras (sem IA generativa, sem custo) que avalia cada dívida — quitar prioritário ou manter mínimo e investir a sobra — considerando reserva de emergência, margem livre, cheque especial e oportunidades de renegociação. Inclui score de saúde financeira e simuladores de entrada pontual e quitação à vista com desconto.",
        comoUsar:
          "Defina a taxa de referência (tipo CDI) pra comparar com a taxa de cada dívida. Use os simuladores pra \"e se eu recebesse R$X\" ou \"e se eu pagasse essa dívida à vista com desconto\".",
      },
      {
        titulo: "Limite de cartão",
        href: "/limite-cartao",
        resumo:
          "Compara, cartão por cartão, o gasto essencial identificado (recorrências marcadas como \"essencial\" e vinculadas àquele cartão) com o limite de crédito atualmente liberado — pra saber quanto dá pra pedir de redução sem risco de bloquear um débito que não pode parar.",
        comoUsar:
          "Marque despesas como \"essencial\" e associe ao cartão certo em Recorrências (ou direto na revisão da importação de extrato). Informe o limite atual de cada cartão aqui pra ver a comparação.",
      },
    ],
  },
  {
    label: "Dados",
    paginas: [
      {
        titulo: "Transações",
        href: "/transacoes",
        resumo: "Todos os lançamentos importados ou lançados manualmente — filtráveis por tipo (receita/despesa) e por categoria, ordenáveis por data ou valor.",
        comoUsar:
          "Clique em \"ver\" numa linha pra abrir o detalhe e editar categoria/valor/data, ou excluir. Selecione várias linhas pra categorizar em lote de uma vez.",
      },
      {
        titulo: "Importar",
        href: "/importar",
        resumo:
          "Página-índice pras três formas de trazer dado pro sistema: extrato bancário (PDF, um lançamento por vez classificado), fatura de cartão (PDF, total/mínimo/vencimento) e print/imagem (100% manual, sem leitura automática).",
        comoUsar:
          "Extrato: revise cada linha antes de confirmar — pode categorizar em lote ou deixar sem categoria e resolver depois em Transações. Nada é gravado até você confirmar.",
      },
      {
        titulo: "Documentos",
        href: "/documentos",
        resumo: "Histórico de todo PDF/imagem já importado ou anexado a um passivo — com preview inline e a lista de onde cada documento é usado.",
        comoUsar: "Clique em \"ver\" pra abrir o painel lateral com o preview do arquivo e os vínculos (transações, passivo-fonte, histórico).",
      },
    ],
  },
  {
    label: "Outros",
    paginas: [
      {
        titulo: "Assistente de configuração",
        href: "/comecar",
        resumo: "Wizard de primeira carga em passos (conta → dívidas → bens → meta → aporte mensal → resumo) — reaproveita os mesmos formulários e cadastros das telas normais.",
        comoUsar: "Use na primeira vez que for configurar o sistema, ou sempre que quiser recadastrar tudo do zero de forma guiada. Pode pular qualquer etapa e voltar depois.",
      },
    ],
  },
];
