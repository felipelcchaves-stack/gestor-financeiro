// Conteúdo de ajuda/documentação do sistema, organizado pelos mesmos
// grupos do menu lateral (AppSidebar.tsx) — pra explicar o que cada tela
// faz e como usar, acessível de qualquer lugar pelo botão de ajuda no
// header (HelpSheet.tsx).
//
// Escrito de propósito em linguagem bem simples (nível de explicação
// pra alguém de uns 18 anos, sem experiência com finanças) — nada de
// termo técnico sem explicação ao lado. Se for adicionar uma página
// nova aqui, mantenha esse mesmo nível.
//
// `topicos` cobre CADA elemento real da tela (card, número, gráfico,
// botão importante) — não invente um tópico que não exista na página.

export type TopicoAjuda = { titulo: string; explicacao: string };

export type PaginaAjuda = {
  titulo: string;
  href: string;
  resumo: string;
  comoUsar: string;
  topicos: TopicoAjuda[];
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
        topicos: [
          { titulo: "Gráfico de entradas x despesas", explicacao: "Mostra, mês a mês, todo o histórico real que já entrou pelo extrato — quanto caiu na conta e quanto saiu. É direto do banco, não é uma previsão." },
          { titulo: "Dívida total (hoje x antes)", explicacao: "Soma tudo que você deve hoje e, se você já registrou um mês anterior, compara com aquele valor pra mostrar se a dívida está subindo ou descendo." },
          { titulo: "Balanço do mês e do ano", explicacao: "Dois cards com entradas, despesas e saldo — um do mês atual e outro acumulado desde 1º de janeiro — tirados direto do extrato importado, ou seja, o que já aconteceu de verdade." },
          { titulo: "A luz colorida (sinal de rota)", explicacao: "Verde: você está indo bem. Amarela: está no limite, preste atenção. Vermelha: a situação está preocupante e precisa de ação agora." },
          { titulo: "Fluxo do mês", explicacao: "Mostra dois números: o que já é certo (confirmado) e o que inclui uma entrada que ainda não caiu na conta (projetado). Se o confirmado estiver zerado ou negativo, é sinal de alerta." },
          { titulo: "Alertas", explicacao: "Avisos automáticos sobre coisas que merecem atenção agora, como uma fatura de cartão que está crescendo mês a mês." },
          { titulo: "O que fazer agora", explicacao: "Lista de ações recomendadas pra você resolver primeiro, cada uma com um botão que já leva direto pra tela certa." },
          { titulo: "A trilha de dívidas", explicacao: "Uma fileira de cartões, um por dívida, na ordem que o sistema recomenda pagar. A primeira da fila é a próxima a receber seu dinheiro extra." },
          { titulo: "Vitória rápida", explicacao: "A dívida mais fácil de matar rapidinho, mostrando quanto ela ainda tem de saldo e quanto de gasto mensal ela libera assim que for quitada." },
          { titulo: "Termômetro e registro mensal", explicacao: "Um gráfico da sua dívida total ao longo do tempo. O botão \"Registrar patrimônio deste mês\" salva um retrato da sua situação atual pra comparar com os meses seguintes." },
        ],
      },
      {
        titulo: "Resumo",
        href: "/resumo",
        resumo:
          "Uma versão com todos os números detalhados — quanto você tem, quanto deve em cada dívida, como estão suas metas. É a mesma informação do Meu Mapa, só que sem a parte de \"o que fazer\", pra quem quer só ver os números.",
        comoUsar: "Use quando quiser ver os números exatos, sem a camada de sugestão do Mapa.",
        topicos: [
          { titulo: "Saldo em conta", explicacao: "O dinheiro que está na sua conta bancária agora, segundo o último extrato importado. Se aparecer traço, é porque ainda não tem extrato importado." },
          { titulo: "Passivo total", explicacao: "A soma de tudo que você deve, somando todas as dívidas cadastradas com valor conhecido." },
          { titulo: "Ativos", explicacao: "A soma de tudo que você tem de bens que valem dinheiro, como investimentos e reservas." },
          { titulo: "Patrimônio líquido", explicacao: "Ativos menos passivos — ou seja, se você vendesse tudo que tem e pagasse tudo que deve, é isso que sobraria. Fica vermelho quando é negativo." },
          { titulo: "Passivo por estrutura", explicacao: "Separa suas dívidas em três grupos: as que só cobram juro sem abater o valor (mais perigosas), as que vão sendo pagas normalmente, e as que não têm juro nenhum." },
          { titulo: "Metas ativas", explicacao: "Cada meta cadastrada aparece com uma barra de progresso, quanto ainda falta, quanto já foi guardado, e o ritmo mensal necessário pra chegar na data combinada." },
        ],
      },
      {
        titulo: "Relatório",
        href: "/relatorio",
        resumo:
          "Uma lista do que fazer na semana ou no mês: a ação mais importante agora (inclusive o que fazer se cair um dinheiro extra na sua mão), como estão suas metas, onde você mais gastou, uma nota de 0 a 100 pra sua saúde financeira, e uma lista do que ainda falta organizar no sistema.",
        comoUsar: "Dê uma olhada aqui uma vez por semana ou no começo do mês. Cada item da lista tem um link direto pra resolver.",
        topicos: [
          { titulo: "Ação prioritária", explicacao: "A recomendação número um do sistema pra agora — o que fazer primeiro com o dinheiro que sobra ou com uma entrada extra que está prevista." },
          { titulo: "Score de saúde financeira", explicacao: "Uma nota que resume sua situação, calculada a partir de coisas como ter reserva de emergência, não estar usando cheque especial e não ter fatura de cartão crescendo." },
          { titulo: "Progresso das metas", explicacao: "Mostra quanto falta pra cada meta e se o ritmo de pagamento está no caminho certo pra bater a data combinada, ou se já está atrasado." },
          { titulo: "Maiores ofensores do mês", explicacao: "As despesas que mais pesaram no seu bolso esse mês, do maior pro menor." },
          { titulo: "O que mudou", explicacao: "Compara os dois últimos meses com dados reais e mostra em quais categorias o gasto mais subiu ou mais caiu." },
          { titulo: "Qualidade dos dados", explicacao: "Avisa quando falta informação pro sistema calcular direito: transações sem categoria, sem vínculo a uma dívida ou meta, passivos desatualizados há muito tempo, ou pagamentos feitos que ainda não foram confirmados na tela da dívida." },
          { titulo: "Checklist da semana/mês", explicacao: "Uma lista de tarefas juntando as ações urgentes, os alertas de risco e o que falta pra melhorar o score, tudo num só lugar pra marcar como feito." },
        ],
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
        topicos: [
          { titulo: "Lista de dívidas ativas", explicacao: "Cada linha é uma dívida: cartão, empréstimo, financiamento ou até dívida informal com alguém. É daqui que sai o cálculo de qual pagar primeiro." },
          { titulo: "Estrutura da dívida", explicacao: "Diz como a dívida se comporta: se ela vai diminuindo normalmente a cada pagamento, se só cobra juro sem nunca abater o valor, ou se não tem juro nenhum." },
          { titulo: "Valor de quitação e custo mensal", explicacao: "Quanto falta pra zerar essa dívida hoje, e quanto ela consome do seu bolso por mês. Quando aparece \"não documentado\", o sistema não consegue calcular sua rota direito até você preencher." },
          { titulo: "Progresso (parcelas)", explicacao: "Mostra em qual parcela você está, tipo 5/12, quando a dívida é parcelada." },
          { titulo: "Aviso de pagamento pendente", explicacao: "Uma etiqueta vermelha avisa quando já existe um pagamento real vinculado a essa dívida, mas ninguém confirmou ainda — então o valor mostrado pode estar desatualizado." },
          { titulo: "Dívidas quitadas", explicacao: "Uma lista separada, embaixo, com as dívidas que você já zerou completamente." },
        ],
      },
      {
        titulo: "Ativos",
        href: "/ativos",
        resumo: "Aqui você cadastra o que você TEM (dinheiro guardado, investimento, imóvel etc), não o que deve. Serve pra calcular seu patrimônio de verdade e pra mostrar se algo seu está garantindo alguma dívida.",
        comoUsar: "Cadastre o valor e quanto tempo levaria pra transformar isso em dinheiro na mão. Se esse bem está garantindo alguma dívida, você vincula isso na tela de detalhe dele.",
        topicos: [
          { titulo: "Lista de ativos", explicacao: "Cada linha é um bem que vale dinheiro — investimento, CDB, reserva — que entra na conta do seu patrimônio real." },
          { titulo: "Valor", explicacao: "Quanto esse ativo vale hoje, em reais." },
          { titulo: "Liquidez", explicacao: "O quão rápido você conseguiria transformar esse ativo em dinheiro na mão, se precisasse." },
          { titulo: "Vinculação com dívidas", explicacao: "Mostra quando um ativo está ligado a uma dívida — por exemplo, um imóvel que foi comprado com financiamento (\"financiado por\") ou que está dado como garantia de um empréstimo (\"garantia de\")." },
        ],
      },
      {
        titulo: "Metas",
        href: "/metas",
        resumo:
          "Uma meta é tipo \"quero zerar essa dívida até tal data\". O sistema calcula quanto você precisa pagar por mês pra conseguir, e avisa se o ritmo atual está dando conta — mas só depois que você começar a importar e organizar seus extratos ligados a essa meta.",
        comoUsar: "Crie a meta escolhendo a dívida (ou dívidas) e a data que você quer zerar. Sem extrato importado e organizado, a meta fica sem informação pra acompanhar o progresso.",
        topicos: [
          { titulo: "Lista de metas", explicacao: "Cada card é um objetivo de quitação que você criou, tipo \"zerar tal dívida até tal data\", com a data-alvo e o status (ativa ou não)." },
          { titulo: "Falta e Alocado", explicacao: "\"Falta\" é quanto ainda precisa ser pago pra bater a meta. \"Alocado\" é quanto você já separou ou pagou em direção a ela até agora." },
          { titulo: "Meses restantes e ritmo necessário", explicacao: "Quantos meses faltam até a data combinada, e quanto você precisaria guardar por mês, a partir de agora, pra conseguir chegar lá a tempo." },
          { titulo: "Aviso de dados insuficientes", explicacao: "Aparece quando ainda não existe nenhum lançamento classificado como pagamento dessa meta — nesse caso o sistema não consegue dizer se você está no ritmo certo ou atrasado." },
        ],
      },
      {
        titulo: "Contas",
        href: "/contas",
        resumo: "Suas contas bancárias e cartões, com o saldo de cada uma. Também é aqui que você registra se tem cheque especial (um limite extra que o banco libera quando a conta fica negativa, cobrando juro alto por isso).",
        comoUsar: "O saldo atualiza sozinho quando você importa um extrato novo (o sistema encontra a linha de \"saldo do dia\"). Ou você pode editar o saldo na mão ao criar a conta.",
        topicos: [
          { titulo: "Lista de contas", explicacao: "Cada linha é uma conta bancária ou cartão que você cadastrou, com o tipo (corrente, poupança, cheque especial, cartão de crédito etc.)." },
          { titulo: "Saldo atual (editável)", explicacao: "O valor que está nessa conta agora. Dá pra digitar um novo número e clicar em \"salvar\" pra atualizar na mão, sem precisar importar extrato." },
          { titulo: "Atualizado em", explicacao: "A última vez que o saldo dessa conta foi mexido, seja por você, por uma importação de extrato, ou automaticamente ao marcar uma transferência com destino nessa conta." },
        ],
      },
      {
        titulo: "Recorrências",
        href: "/recorrencias",
        resumo:
          "Dinheiro que entra ou sai todo mês do mesmo jeito: salário, aluguel, assinatura de streaming — ou coisas pontuais tipo 13º salário. Essa informação é usada pra calcular quanto sobra do seu dinheiro todo mês (no Meu Mapa) e qual é a ação mais urgente (no Relatório).",
        comoUsar:
          "Cadastre se é uma entrada ou uma saída de dinheiro, se se repete todo mês ou é só uma vez, e se você já tem certeza do valor ou é só uma estimativa. Marque como \"essencial\" as contas que você não pode deixar de pagar. Se parou de pagar alguma coisa por um tempo, desative em vez de excluir, pra não perder o histórico.",
        topicos: [
          { titulo: "Lista de recorrências", explicacao: "Entradas e despesas que se repetem — salário, aluguel, assinatura de streaming. Elas alimentam o cálculo de \"quanto sobra por mês\" do Mapa." },
          { titulo: "Frequência e confiabilidade", explicacao: "Frequência é de quanto em quanto tempo ela se repete (mensal, semanal, anual ou uma única vez). Confiabilidade diz se o valor é \"confirmado\" (você tem certeza) ou \"estimado\" (um chute)." },
          { titulo: "Essencial", explicacao: "Uma etiqueta que marca despesas que você não pode cortar de jeito nenhum, mesmo em aperto — tipo aluguel ou remédio." },
          { titulo: "Ativa/Inativa", explicacao: "Uma recorrência inativa fica na lista (meio apagada) mas para de contar no cálculo do que sobra por mês, sem precisar excluir de vez." },
          { titulo: "Vínculo com cartão/dívida", explicacao: "Quando a recorrência é o pagamento de uma dívida específica, aparece o nome dela na coluna \"Cartão\", ligando o gasto mensal à dívida certa." },
        ],
      },
      {
        titulo: "Categorias",
        href: "/categorias",
        resumo: "As \"gavetas\" onde você organiza seus gastos e ganhos (ex: Moradia, Mercado, Salário) — cada categoria pode ter subcategorias dentro dela.",
        comoUsar: "Você pode criar uma categoria nova aqui, ou direto na hora de importar um extrato. Só não dá pra excluir uma categoria se já tiver algo organizado dentro dela.",
        topicos: [
          { titulo: "Árvore de categorias", explicacao: "As categorias usadas pra organizar suas transações, orçamentos e recorrências. Categorias com traço na frente são subcategorias, dentro de uma categoria principal." },
          { titulo: "Vínculos", explicacao: "Mostra quantas transações, regras automáticas, recorrências ou subcategorias já usam essa categoria — ajuda a saber se dá pra excluir sem quebrar nada." },
          { titulo: "Categoria protegida", explicacao: "Uma etiqueta que avisa que essa categoria não pode ser cortada em simulações de corte de gastos, mesmo que o sistema sugira economizar." },
        ],
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
        topicos: [
          { titulo: "As quatro estratégias lado a lado", explicacao: "Cada cartão mostra um jeito diferente de atacar as dívidas com o mesmo dinheiro extra: pagar primeiro a menor, a que corta mais juro, a que alivia o bolso mais rápido, ou uma mistura das duas últimas." },
          { titulo: "Tempo total, juro total e primeiro alívio", explicacao: "Em cada estratégia você vê quantos meses até zerar tudo, quanto de juro paga no total, e em que mês sente a primeira dívida sumindo de verdade." },
          { titulo: "Aviso de \"meses no escuro\"", explicacao: "Avisa quando uma dívida vai ficar meses sem diminuir visivelmente — só pagando juro — até quitar de uma vez. Bom saber disso antes, pra não achar que travou." },
          { titulo: "Aporte mensal e aporte pontual", explicacao: "Aporte mensal é o dinheiro extra que você separa todo mês, além do mínimo, pra pagar dívida. Aporte pontual é um valor que entra só uma vez, tipo 13º ou restituição." },
          { titulo: "Divisão da estratégia híbrida", explicacao: "Esse controle define quanto do seu dinheiro extra vai pra dívida mais cara (mais juro) e quanto vai pra mais fácil de quitar rápido, ao mesmo tempo." },
          { titulo: "Pedir recomendação da IA", explicacao: "Manda os números já calculados pra uma inteligência artificial (Claude) escolher qual das quatro estratégias faz mais sentido pro seu caso e sugerir onde cortar gasto pra sobrar mais dinheiro. Essa chamada tem um custo pequeno." },
          { titulo: "Gráfico de trajetória das dívidas", explicacao: "Mostra em um só gráfico como o total das suas dívidas desce mês a mês em cada estratégia, pra comparar visualmente qual desce mais rápido." },
          { titulo: "Usar essa estratégia", explicacao: "Ao clicar, essa estratégia vira a rota oficial usada no Mapa e no Consultor — é a ordem que o sistema vai seguir recomendando dali pra frente." },
        ],
      },
      {
        titulo: "Ataque rápido",
        href: "/ataque-rapido",
        resumo: "Foco só nas dívidas pequenas, que ficam incomodando no dia a dia. Mostra de um jeito simples em quanto tempo cada uma delas some, sem a tabela cheia de números da tela \"Comparar estratégias\".",
        comoUsar: "Ajuste quanto dinheiro extra você tem disponível e veja as dívidas pequenas sumindo uma atrás da outra.",
        topicos: [
          { titulo: "Lista de dívidas pequenas", explicacao: "Mostra as dívidas menores (cartão, financiamento pequeno, parcela solta) já marcadas pra simular. As maiores ganham a etiqueta \"grande\" e ficam desmarcadas, mas dá pra incluir ou tirar qualquer uma." },
          { titulo: "Quanto você pode direcionar por mês", explicacao: "Controle deslizante pra dizer quanto de dinheiro extra, além do mínimo, você consegue mandar por mês pra essas dívidas pequenas." },
          { titulo: "Resumo: quando tudo some", explicacao: "Uma frase mostra em quantos meses todas as dívidas marcadas somem, e quanto dinheiro por mês vai sobrar no seu caixa quando a última for paga." },
          { titulo: "Fila de dívidas caindo uma a uma", explicacao: "Lista animada mostrando a ordem em que cada dívida vai sumir e em qual mês (e data) isso acontece, sempre atacando primeiro quem pesa mais no seu caixa todo mês." },
          { titulo: "Aviso de simulação não fechar", explicacao: "Se o valor mensal escolhido for baixo demais, o sistema avisa que nem todas as dívidas fecham em 50 anos — sinal pra aumentar o valor." },
        ],
      },
      {
        titulo: "Maiores ofensores",
        href: "/ofensores",
        resumo: "Ranking de gastos por categoria (com detalhamento por subcategoria) e orçamento por categoria com acompanhamento de uso mensal.",
        comoUsar: "Alterne entre mês/trimestre/ano. Defina um limite mensal por categoria pra acompanhar o quanto já foi usado.",
        topicos: [
          { titulo: "Filtro de período", explicacao: "Escolha se quer ver os gastos deste mês, do trimestre, dos últimos 6 meses, do ano ou de todo o histórico já registrado." },
          { titulo: "Ver por categoria ou por credor", explicacao: "Categoria agrupa o gasto por tipo (ex: todas as dívidas de empréstimo somadas). Credor separa cada dívida ou cada lançamento sem vínculo individualmente." },
          { titulo: "Ranking dos maiores gastos", explicacao: "Lista do que mais pesou no seu bolso no período escolhido, do maior pro menor, com as subcategorias abertas quando existem." },
          { titulo: "Gráfico de saldo por credor", explicacao: "Pra cada credor, mostra como o saldo devedor real caiu até hoje e, quando já existe uma rota de pagamento definida, projeta como ele vai continuar caindo." },
          { titulo: "Comparativo dos últimos 12 meses", explicacao: "Gráfico fixo com um ano inteiro, sempre, pra ver se cada ofensor está melhorando ou piorando mês a mês — não muda com o filtro de período lá em cima." },
          { titulo: "Orçamento por categoria", explicacao: "Defina um limite de gasto mensal pra uma categoria (tipo \"Mercado\") e acompanhe numa barra quanto já foi usado esse mês perto desse limite." },
        ],
      },
      {
        titulo: "Consultor",
        href: "/consultor",
        resumo:
          "Uma calculadora (sem inteligência artificial, sem custo nenhum) que olha cada uma das suas dívidas e diz: vale mais a pena quitar essa agora, ou pagar só o mínimo dela e guardar o resto do dinheiro? Ela leva em conta se você tem uma reserva de emergência, quanto sobra do seu dinheiro por mês, e se algum cartão tem cheque especial. Também dá uma nota de 0 a 100 pra sua saúde financeira e simula \"e se eu recebesse um dinheiro extra\" ou \"e se eu pagasse essa dívida à vista com desconto\".",
        comoUsar:
          "Informe uma taxa de referência do mercado (por exemplo, quanto rende a poupança ou um investimento seguro) pra comparar com o juro de cada dívida sua. Use os simuladores pra testar cenários do tipo \"e se...\".",
        topicos: [
          { titulo: "Termômetro de saúde financeira", explicacao: "Um mostrador de 0 a 100 que resume sua situação: reserva de emergência, sobra de caixa no fim do mês, uso de cheque especial e fatura de cartão crescendo. Verde é saudável, amarelo é atenção, vermelho é crítico." },
          { titulo: "Como chegar a 100 pontos", explicacao: "Lista o que ainda está tirando pontos do seu score e quanto vale cada item, com um link direto pra resolver cada um." },
          { titulo: "Avisos de prioridade máxima", explicacao: "Quando aparecem, avisam de algo urgente: uso de cheque especial (a dívida mais cara que existe), reserva de emergência incompleta, ou sobra de caixa zerada/negativa — tudo isso deveria ser resolvido antes de acelerar o pagamento de dívidas." },
          { titulo: "Vale mais resgatar investimento", explicacao: "Aponta quando você tem dinheiro investido travado como garantia de uma dívida que cobra mais juro do que esse investimento rende — nesse caso, resgatar e quitar a dívida economiza dinheiro todo mês." },
          { titulo: "Oportunidades de renegociação", explicacao: "Mostra dívidas cujo juro parece estar acima da faixa comum de mercado, sugerindo que vale tentar renegociar ou trocar de credor (portabilidade)." },
          { titulo: "Taxa de referência (tipo CDI)", explicacao: "É a taxa usada de comparação: se o juro de uma dívida for maior que essa taxa, compensa mais quitar a dívida do que deixar o dinheiro investido. CDI é uma taxa básica do mercado financeiro brasileiro usada como referência de rendimento." },
          { titulo: "Reserva pra dívida (cofre automático)", explicacao: "Mostra quanto já foi separado automaticamente de uma % da sua receita pra uma conta reservada só pra quitar dívida, e se esse saldo já dá pra quitar alguma dívida inteira agora." },
          { titulo: "Simuladores de dinheiro extra", explicacao: "Dois simuladores: um mostra pra onde deveria ir um dinheiro avulso (13º, restituição, bônus); o outro calcula quanto você economiza se um credor oferecer desconto pra quitar a dívida à vista." },
          { titulo: "Veredicto de cada dívida", explicacao: "Pra cada dívida ativa, diz se o certo é \"quitar prioritário\" (o juro compensa atacar agora) ou \"manter mínimo, investir a sobra\" (o juro é baixo o suficiente pra não valer a pena antecipar), com o motivo explicado." },
        ],
      },
      {
        titulo: "Limite de cartão",
        href: "/limite-cartao",
        resumo:
          "Compara, cartão por cartão, quanto você gasta por mês só com contas que não pode deixar de pagar (marcadas como \"essencial\") com o limite de crédito que você tem liberado nesse cartão — pra você saber se dá pra pedir uma redução de limite sem risco de travar algum pagamento importante.",
        comoUsar:
          "Marque as contas essenciais na tela de Recorrências (ou direto na hora de importar um extrato) e associe cada uma ao cartão certo. Depois, informe aqui o limite atual de cada cartão pra ver a comparação.",
        topicos: [
          { titulo: "Gasto essencial por cartão", explicacao: "Mostra quanto de despesa que não pode parar (conta de luz, assinatura importante, etc.) está passando em cada cartão por mês." },
          { titulo: "Lista de despesas essenciais vinculadas", explicacao: "Detalha quais recorrências foram marcadas como essenciais nesse cartão — se a lista estiver vazia, é sinal de marcar isso nas Recorrências ou na importação de extrato." },
          { titulo: "Limite atual liberado", explicacao: "Campo pra registrar quanto de limite o banco libera hoje nesse cartão — é a base de comparação com o gasto essencial." },
          { titulo: "Meta de gasto mensal", explicacao: "Campo pra definir um teto de gasto mensal nesse cartão, usado depois na tela Cartões pra acompanhar o progresso." },
          { titulo: "Quanto dá pra pedir de redução", explicacao: "Compara o limite atual com o gasto essencial e avisa: se sobra limite, diz quanto dá pra pedir de redução sem risco; se o limite já está no limite do essencial, avisa que reduzir mais pode travar um pagamento importante." },
        ],
      },
      {
        titulo: "Cartões",
        href: "/cartoes",
        resumo:
          "Mostra, cartão por cartão, quanto você tem gastado ao longo dos meses, com uma estimativa de quanto deve vir nos próximos meses seguindo esse mesmo ritmo. Também mostra o quanto você já gastou nesse cartão neste mês perto de uma meta que você definir, e as compras parceladas que ainda vão cobrar nos próximos meses.",
        comoUsar: "Acompanhe aqui se algum cartão está com o gasto subindo. Defina uma meta de gasto mensal pra cada cartão se quiser se controlar melhor.",
        topicos: [
          { titulo: "Gasto do mês por cartão", explicacao: "Mostra quanto já foi gasto neste cartão desde o início do mês atual." },
          { titulo: "Barra de progresso da meta", explicacao: "Se você já definiu uma meta de gasto mensal (em Limite de cartão), uma barra mostra quanto já foi usado dela; sem meta definida, aparece um link pra criar uma." },
          { titulo: "Gráfico de histórico e tendência", explicacao: "Mostra como o gasto nesse cartão andou nos últimos meses e estima, pelo ritmo recente, como deve continuar nos próximos meses." },
          { titulo: "Próximas parcelas em aberto", explicacao: "Lista compras parceladas que ainda não terminaram de pagar, mostrando quanto falta de cada uma, quantas parcelas restam e em quais meses elas ainda vão cair na fatura." },
          { titulo: "Link pra Limite de cartão", explicacao: "Atalho pra ver a conta detalhada de quanto dá pra reduzir o limite desse cartão sem afetar gasto essencial." },
        ],
      },
      {
        titulo: "Cofre",
        href: "/cofre",
        resumo:
          "Um jeito de separar automaticamente uma parte do seu salário (ou de outra entrada de dinheiro) pra uma conta específica, só pra usar em quitar dívida — assim esse dinheiro não se mistura com o resto e não é gasto por engano com outra coisa.",
        comoUsar: "Configure qual % do seu ganho deve ser separado e pra qual conta. A tela mostra quanto já foi separado de fato até agora, e pode te dar uma sugestão (com IA) de meta ou de onde cortar gasto pra separar mais rápido.",
        topicos: [
          { titulo: "Cofre ainda sem rateio configurado", explicacao: "Se você ainda não configurou a separação automática de receita (em Consultor), a tela mostra só esse aviso — nenhum indicador aparece até isso ser configurado." },
          { titulo: "Indicadores do cofre", explicacao: "Mostra o saldo atual guardado, o total já separado desde que o rateio começou, a meta calculada pela % definida, e quanto ainda falta separar pra bater essa meta." },
          { titulo: "Dívida que o saldo já cobre", explicacao: "Quando o saldo do cofre já é suficiente pra quitar alguma dívida inteira, esse aviso aparece destacando qual é e o valor exato." },
          { titulo: "Alvo sugerido pra essa reserva", explicacao: "Mostra qual dívida é a próxima prioridade pra esse dinheiro guardado (seguindo a rota de menor juro escolhida) e tem um botão pra criar uma meta com um clique." },
          { titulo: "Outras dívidas que o cofre poderia aliviar", explicacao: "Mesmo não sendo a prioridade de menor juro, algumas dívidas menores já caberiam no saldo atual — quitá-las libera a parcela mensal delas e pode até adiantar em quantos meses a dívida principal fecha." },
          { titulo: "Metas financiadas por este cofre", explicacao: "Cada meta mostra sua prioridade na fila, quanto falta pra bater o valor, o ritmo mensal necessário, e uma barra de quanto do saldo do cofre já cobre essa meta especificamente." },
          { titulo: "Sugestão de corte da IA por meta", explicacao: "Pra cada meta, dá pra pedir uma sugestão de onde cortar gasto pra fechar ela mais rápido — gerada por inteligência artificial a partir dos seus gastos reais." },
          { titulo: "Criar nova meta", explicacao: "Formulário pra criar uma meta nova ligada a esse cofre: nome, valor-alvo (ou escolher uma dívida com saldo já documentado), data-alvo e quais dívidas ela mira." },
        ],
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
        topicos: [
          { titulo: "Botão \"Grupos sugeridos\"", explicacao: "O sistema já separa lançamentos parecidos que ainda não têm categoria ou vínculo e sugere pra você aplicar em vários de uma vez, sem editar linha por linha." },
          { titulo: "Abas Receitas, Despesas e Todas", explicacao: "Filtra a lista pra mostrar só o que entrou, só o que saiu, ou tudo junto." },
          { titulo: "Filtro de período", explicacao: "Escolhe se você quer ver as transações do mês, do trimestre, dos últimos 6 meses, do ano ou de todo o histórico." },
          { titulo: "Avisos de \"sem categoria\" e \"sem vínculo\"", explicacao: "Mostram quantas transações ainda não foram classificadas ou não estão ligadas a nenhuma dívida, bem ou meta. Sem vínculo, o pagamento real não atualiza o saldo da dívida." },
          { titulo: "Filtro de transferências", explicacao: "Isola o dinheiro que só mudou de conta, como um PIX entre contas suas — isso não conta como gasto nem receita nos relatórios." },
          { titulo: "Busca por descrição, valor e categoria", explicacao: "Procura um texto na descrição (ou ative \"credor parecido\" pra achar variações do mesmo nome), um valor exato, ou filtra pela categoria atual." },
          { titulo: "Selecionar várias e aplicar em lote", explicacao: "Marque o checkbox de várias transações ao mesmo tempo pra colocar todas na mesma categoria, ligar ao mesmo passivo/ativo/meta, ou marcar/desmarcar como transferência de uma vez só." },
          { titulo: "Detalhes de cada linha", explicacao: "Cada linha tem um botão pra abrir e editar aquela transação sozinha, um link \"ver documento\" se houver um arquivo anexado, e \"achar parecidos\" pra encontrar outras com a mesma descrição." },
        ],
      },
      {
        titulo: "Importar",
        href: "/importar",
        resumo:
          "A porta de entrada pras 3 formas de trazer suas movimentações pro sistema: extrato do banco em PDF (o sistema lê e você confirma cada linha), fatura de cartão em PDF (o sistema pega o total, o mínimo e a data de vencimento) e foto/print de um comprovante (você digita tudo na mão).",
        comoUsar:
          "No extrato: confira cada linha antes de confirmar — você pode organizar várias de uma vez ou deixar sem categoria e resolver depois em Transações. Nada é salvo até você clicar em confirmar.",
        topicos: [
          { titulo: "Extrato bancário", explicacao: "Importa o PDF do extrato da sua conta — cada lançamento é lido e já vem com uma classificação sugerida na hora." },
          { titulo: "Fatura de cartão", explicacao: "Importa o PDF da fatura do cartão — total, valor mínimo e vencimento, com um palpite automático de categoria." },
          { titulo: "Print / imagem", explicacao: "Pra quando você só tem um print do app do banco — aqui você digita as informações à mão, sem leitura automática do arquivo." },
        ],
      },
      {
        titulo: "Documentos",
        href: "/documentos",
        resumo: "Todo PDF ou imagem que você já importou fica guardado aqui, com uma prévia pra visualizar e a lista de onde cada um foi usado.",
        comoUsar: "Clique em \"ver\" pra abrir a prévia do arquivo e ver a quais transações ou dívidas ele está ligado.",
        topicos: [
          { titulo: "Coluna \"Tipo\"", explicacao: "Mostra se o arquivo é um extrato, uma fatura, uma imagem (print) ou um contrato, com uma etiqueta colorida." },
          { titulo: "Coluna \"Vínculos\"", explicacao: "Conta quantas transações, dívidas ou ciclos de fatura estão ligados a esse documento — é o que mostra o que junto ele levaria se fosse apagado." },
          { titulo: "Botão \"ver\"", explicacao: "Abre uma prévia do arquivo (imagem ou PDF) na tela, mostra os vínculos dele e traz um link pra abrir em outra aba." },
          { titulo: "Botão \"Excluir\"", explicacao: "Apaga o documento e avisa antes se isso também vai apagar transações ou dívidas ligadas a ele — essa ação não pode ser desfeita." },
        ],
      },
      {
        titulo: "Relatório por categoria",
        href: "/relatorio/categorias",
        resumo: "Mostra quanto você ganhou e gastou em cada categoria, num período que você escolhe — pra te ajudar a achar onde cortar gasto e sobrar mais dinheiro pra pagar dívida.",
        comoUsar: "Escolha o período (esse mês, trimestre, ano, ou tudo) e, se quiser, marque só as categorias que te interessam pra ver o total só delas.",
        topicos: [
          { titulo: "Filtro de período", explicacao: "Escolhe se o relatório mostra o mês atual, o trimestre, os últimos 6 meses, o ano ou todo o histórico." },
          { titulo: "Card \"Saldo do período\"", explicacao: "Mostra três números lado a lado: quanto entrou (receitas), quanto saiu (despesas) e a diferença entre os dois (saldo)." },
          { titulo: "Filtro por categoria", explicacao: "Marque uma categoria principal pra ver ela inteira com as subcategorias, ou só subcategorias específicas pra ver só essas — sem marcar nada, mostra tudo." },
          { titulo: "Ranking de despesas por categoria", explicacao: "Lista cada categoria de gasto com o total gasto nela, e abre as subcategorias por baixo pra você ver onde exatamente o dinheiro foi." },
          { titulo: "Ranking de receitas por categoria", explicacao: "O mesmo tipo de lista, só que do lado do que entrou — mostra de onde vêm suas receitas." },
          { titulo: "Link para \"Maiores ofensores\"", explicacao: "No fim da página, um atalho pra um relatório mais completo, com orçamento por categoria, gráfico mensal e trajetória de saldo por credor." },
        ],
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
        topicos: [
          { titulo: "Barra de progresso do assistente", explicacao: "Mostra em qual etapa você está e quantas faltam — dá pra pular qualquer uma e voltar depois pelo menu, em \"Assistente de configuração\"." },
          { titulo: "Etapa: Início", explicacao: "Tela de boas-vindas explicando que em poucos passos você monta a base do sistema pra ele calcular sua rota de saída das dívidas." },
          { titulo: "Etapa: Conta", explicacao: "Cadastra onde seu dinheiro entra e sai — conta corrente, conta PJ, cheque especial. É opcional, dá pra pular." },
          { titulo: "Etapa: Dívidas", explicacao: "Cadastra cartão, empréstimo, financiamento ou até dívida informal — é a partir daqui que o sistema monta sua rota de saída." },
          { titulo: "Etapa: Bens", explicacao: "Cadastra CDB, investimento ou reserva — opcional, mas ajuda a calcular seu patrimônio real." },
          { titulo: "Etapa: Meta", explicacao: "Cria um objetivo do tipo \"zerar tal dívida até tal data\". Dá pra criar mais metas depois, com calma." },
          { titulo: "Etapa: Aporte mensal", explicacao: "Você informa quanto consegue direcionar por mês além dos pagamentos mínimos — esse número é o que libera a trilha completa e as datas estimadas de quitação no seu Mapa." },
          { titulo: "Etapa: Pronto (resumo)", explicacao: "Mostra um resumo do que você cadastrou — contas, dívidas, bens, meta e aporte — e um botão pra ir direto pro seu Mapa." },
        ],
      },
    ],
  },
];
