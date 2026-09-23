# Roadmap: de "sistema de dados" para "Rota de Saída"

## Por que isso existe

O sistema, na primeira versão, fazia a conta certa mas errava o papel: se
comportava como ferramenta de back-office (tabelas, formulários, um
dashboard de números) quando o que o Felipe precisava era de uma bússola.
Feedback dele, literal:

- Visualmente não é intuitivo.
- Não fica claro **quando** ele deve cadastrar um passivo ou um ativo.
- Ele não entende "tecniquês" — jargão técnico é barreira, não detalhe.
- Ele quer um **mapa** que o tire do buraco, não uma planilha bonita.
- Ele quer simulações específicas para as dívidas menores que sugam o caixa
  no dia a dia (não só as três grandes informais).
- Ele quer uma "IA" que valide se o caminho que está seguindo é bom — mesmo
  que o progresso seja gradual.
- O sistema deve ser **uma ferramenta que orienta decisão**, não um espelho
  passivo dos dados.

Decisões de arquitetura já tomadas com o Felipe:

1. **IA mentora = sinal local (matemática, grátis, instantânea) + botão
   "gerar resumo para revisar com Claude"** quando ele quiser uma conversa
   mais profunda — sem chat embutido com custo por consulta nem envio
   automático de dados financeiros pra fora da máquina dele.
2. **Visual do mapa = trilha tipo tabuleiro de jogo** (gamificado, cores
   vivas, sensação de progresso).

## Conceito guarda-chuva: "Rota de Saída"

A tela inicial (`/`) não é mais um dashboard de números — é **o Mapa**: uma
trilha visual das dívidas na ordem recomendada de ataque, sempre respondendo
"o que eu faço agora?". O dashboard técnico continua existindo em `/resumo`
pra quem quiser os detalhes.

## Phase 0 — ✅ feito

- `/` = Mapa de Saída: frase-guia em linguagem simples, sinal de rota
  (verde/amarelo/vermelho), até 3 próximas ações com botão direto pra tela
  certa, trilha visual das dívidas na ordem de ataque, vitória rápida em
  destaque.
- `Configuracao` (aporte mensal extra) — configurado uma vez, usado tanto no
  Mapa quanto em `/otimizacao`.
- `src/lib/proximaAcao.ts` — motor de "o que fazer agora".
- `src/lib/sinal.ts` — sinal de rota determinístico.
- `encontrarVitoriaRapida` em `src/lib/otimizacao.ts`.
- Textos de "quando usar isto" em Passivos, Ativos e Metas.
- Navegação renomeada: Meu Mapa · Resumo · Passivos · Ativos · Metas ·
  Comparar estratégias · Contas · Transações · Importar extrato.

## Phase 1 — ✅ feito — Ferramentas de ataque às dívidas pequenas

- `/ataque-rapido`: reaproveita `simularOrdem` e `ordenarPorMaiorAlivioCaixa`
  (já existem, testados), mas com interface simples focada nas dívidas
  menores que sugam caixa mês a mês: um slider de aporte, uma resposta só
  ("essa aqui vira pó em X meses"), sem a tabela técnica de 3 colunas de
  `/otimizacao` (que continua existindo para quem quiser comparar os 3
  critérios a fundo).
- "Efeito dominó" visual: cards que "caem" em sequência conforme cada
  dívida é projetada para fechar, reforçando a lógica de bola de neve.

## Phase 2 — ✅ feito — Termômetro + mentor sob demanda

- `PatrimonioSnapshot` (mês de referência, patrimônio líquido, ativo total,
  passivo total) + botão "Registrar patrimônio deste mês" no Mapa —
  alimenta o `Termometro.tsx` (gráfico de tendência em SVG puro, sem lib de
  gráfico): linha do patrimônio líquido mês a mês, com a linha de zero
  marcada — saindo do buraco vs. voltando pra ele (seção 4.3 do PRD).
- `/resumo/ia`: monta um resumo em markdown (posição atual, sinal, rota
  recomendada, metas, histórico de patrimônio) com botão "Copiar resumo" —
  pra colar numa conversa com o Claude e pedir uma segunda opinião. Cumpre
  "IA mentora" sem embutir chamada de API paga nem vazar dado automático.
- `calcularSinal` agora também escala pra AMARELO quando o patrimônio
  líquido piorou nos últimos meses registrados (2–3 meses seguidos).
- `src/lib/estadoAtual.ts`: centraliza o carregamento + cálculo que o Mapa
  e o `/resumo/ia` compartilham, pra não duplicar a lógica entre as duas
  telas.

## Phase 3 — ✅ feito — Seção 4.3 completa do PRD

- `/ofensores`: relatório de maiores ofensores (ranking por categoria raiz,
  com detalhamento por subcategoria — dentro de Empréstimo, por credor;
  dentro de Cartão de Crédito, por cartão), com seletor de período (mês /
  trimestre / ano). Orçamento por categoria na mesma tela: limite mensal +
  acompanhamento de quanto já foi usado, com barra de progresso.
- `src/lib/alertas.ts` — alertas de padrão de risco: cheque especial em uso
  (com o alerta da janela de dias sem juros), fatura de cartão que voltou a
  crescer (usa o histórico de `CicloFaturaPassivo`), e passivo novo sem
  meta vinculada. Esse último tem um limite de disparo (no máximo 3 de uma
  vez) pra não virar ruído numa carga em lote — só sinaliza quando é
  realmente uma surpresa pontual, não quando é o próprio histórico normal
  de cadastro.
- Alertas aparecem no Mapa e entram no resumo pra IA.
- Correção de schema no caminho: `OrcamentoCategoria.referencia` era
  `String?` com `null` significando "todo mês" — no SQLite, `NULL` não é
  deduplicado por `UNIQUE`, então isso quebraria o upsert de "um orçamento
  recorrente por categoria" assim que houvesse mais de uma linha. Trocado
  por um valor fixo `"recorrente"` (não nulo) antes de a tela existir de
  verdade, já que o model nunca tinha sido usado até agora.

Com isso, as quatro phases do roadmap original estão completas.

## Phase 4 — ✅ feito — o que tinha ficado faltando do PRD original

Auditoria pedida pelo Felipe ("tem mais alguma coisa no roadmap?") que
achou três itens do PRD nunca construídos e uma pergunta do PRD nunca
respondida. Detalhes em
`.claude/plans/entendi-a-proposta-do-sorted-lemur.md`. Resumo:

- **Margem livre mensal** (`src/lib/margemLivre.ts`): entradas recorrentes
  − despesas recorrentes − parcelas dos passivos − aporte de quitação.
  Aparece em destaque no Mapa e escala o sinal pra VERMELHO quando fica
  zero ou negativa. Com os dados reais do Felipe, deu **-R$2.547,26** —
  exatamente o padrão que o PRD queria pegar antes de repetir.
- **Importação de fatura de cartão** (`/importar/fatura`) e **de
  imagem/print** (`/importar/imagem`) — a de imagem é 100% manual de
  propósito (sem OCR/IA paga, mesma decisão já tomada pro "mentor").
  `/importar` virou uma página-índice pras três, pra não inflar mais o
  menu.
- **Ver documento original** — `src/app/api/documentos/[id]/route.ts`
  serve os PDFs/imagens salvos de volta; link em Transações e no detalhe
  de cada Passivo (documento-fonte, histórico, ciclos de fatura).
- **Lembrete de revisão periódica** — `calcularProximasAcoes` agora avisa
  quando faz tempo (1º registro nunca feito após 45 dias de uso, ou 2+
  meses sem registrar de novo) sem sobrecarregar quando já tem coisa mais
  urgente pra resolver.
- **Pergunta 6 do PRD** (critério padrão do motor de otimização) marcada
  como resolvida em `PRD_sistema_financeiro_pessoal.md`: menor juro total.
- Bug real encontrado com o PDF de extrato de verdade do Felipe (não
  sintético): linhas "SALDO DO DIA" do Itaú estavam virando "entradas"
  falsas, e o saldo da conta nunca seria atualizado nesse formato (porque
  ele não coloca saldo em cada lançamento, só nessas linhas separadas).
  Corrigido em `src/lib/extrato-parser.ts` — essas linhas agora alimentam
  a detecção do saldo atual da conta em vez de virar transação.

## Redesign — ✅ Fase 1 feita — wizard de primeira carga + menu lateral

Feedback do Felipe: sentindo-se perdido navegando, menu superior apertado
(13 itens), pediu painéis laterais ("sheets") e um visual mais bonito.
Adotado **shadcn/ui** (Base UI) como base de componentes — dá `Sidebar` e
`Sheet` prontos, acessíveis, em vez de desenhar cada peça a mão.

- `src/app/layout.tsx` + `src/components/AppSidebar.tsx`: barra superior
  virou menu lateral (`Sidebar` do shadcn), com os itens agrupados
  (Principal / Cadastros / Ferramentas / Dados) em vez de uma fila só, com
  ícone por item (`lucide-react`) e item fixo "Assistente de
  configuração". Responsivo: em tela estreita vira um drawer (recurso
  nativo do componente, não é código meu).
- `/comecar` (`src/app/comecar/`): wizard de primeira carga em 7 passos
  (boas-vindas → conta → dívidas → bens → meta → aporte mensal → resumo).
  Reaproveita 100% dos formulários e actions que já existiam
  (`ContaForm`, `PassivoForm`, `AtivoForm`, `MetaForm`,
  `definirAporteMensal`) — zero lógica de backend nova, cada action ganhou
  uma variante `SemRedirecionar` pra não navegar embora entre os passos.
  `calcularProximasAcoes` aponta pra cá quando não há passivo cadastrado.
- Extraído `src/app/contas/ContaForm.tsx` do que antes era inline em
  `/contas/novo`, pra poder reaproveitar no wizard sem duplicar.
- Corrigido de brinde: um bug em `src/hooks/use-mobile.ts` (gerado pelo
  CLI do shadcn) que violava a regra de lint contra `setState` síncrono
  dentro de `useEffect`.

## Reskin — ✅ etapa 1 feita — visual inspirado no Cockpit 36M

O Felipe pediu pra copiar o visual (fontes, cards, layout — sem
funcionalidade) de outro projeto pessoal dele,
`felipelcchaves-stack/cockpit-36m-vision` ("Wealth Command"). Explorado
via `gh api` (leitura, token já autenticado da conta dele) — nenhum
código de negócio daquele projeto foi copiado, só tokens de design.

- `src/app/globals.css`: fontes Sora (títulos) + Manrope (corpo) via
  `next/font/google`; paleta OKLCH dark-mode-único com cores semânticas
  `--liquidity` (verde), `--debt` (vermelho), `--gold` (dourado,
  primária); utilitários `.glass-card`, `.gold-text`, `.num`; raio de
  borda subiu de `0.625rem` pra `0.9rem`. Pacote `motion` instalado.
- `src/components/AppSidebar.tsx`: logo em badge dourado + item ativo com
  destaque dourado.
- Novo `src/components/PageHeader.tsx`: eyebrow dourado + título + entrada
  animada, reaproveitável nas próximas páginas.
- Mapa (`/`) e Resumo (`/resumo`) totalmente reskinados como vitrine —
  cards com ícone-badge e cor semântica certa, `TrilhaDeSaida.tsx` e
  `Termometro.tsx` também retemados.
- Sem alternância claro/escuro (decisão consciente — vide plano) e sem
  Recharts (termômetro continua em SVG à mão, só re-temático).

## Reskin — ✅ Fase 2 feita — resto do sistema

Felipe confirmou o visual do Mapa como referência ("O visual mais correto
pra mim é o que está no mapa"). Aplicado o mesmo tratamento — mecânico e
depois estrutural — em todas as páginas que ainda estavam nas classes
neutras antigas:

- Substituição mecânica de classe (script com lista ordenada de
  regex) em 28 arquivos: cards (`border-neutral-200 bg-white` →
  `glass-card rounded-2xl`), texto (`neutral-900/700` → `foreground`,
  `600/500` → `muted-foreground`, `400` → `muted-foreground/70`), cores
  semânticas (`red-*` → `debt`, `emerald-*` → `liquidity`, `amber-*` →
  `gold`), botão primário (`bg-neutral-900` → `bg-primary`) — Passivos,
  Ativos, Metas, Contas, Transações, Importar (índice + 3 subpáginas),
  Comparar estratégias, Ataque rápido, Maiores ofensores, `/comecar`.
- Passada estrutural manual nas páginas de listagem: `PageHeader`
  (eyebrow + título + descrição, com entrada animada) + ícone
  `lucide-react` + botão de ação primário como componente `Button` do
  shadcn — Passivos, Ativos, Metas, Contas, Transações, Importar,
  Comparar estratégias, Ataque rápido, Maiores ofensores. `PassivoForm`
  também ganhou `Button` de verdade (os outros formulários mantêm classe
  equivalente aplicada pelo script, mesmo resultado visual).
- Corrigido de brinde: entidades HTML (`&ldquo;`/`&rdquo;`) dentro de uma
  prop de string comum não são decodificadas pelo React (só funcionam em
  texto filho de JSX) — trocado por aspas curvas literais em
  `metas/page.tsx`.
- Verificação: `tsc --noEmit` e `lint` limpos, grep confirma zero classes
  `neutral-/amber-/emerald-/red-*/bg-white` fora de `globals.css` e do
  código gerado pelo shadcn, todas as ~25 rotas (incluindo detalhe/editar
  com IDs reais) retornando 200 num servidor limpo.

## Reskin — ✅ Fase 3 feita — pendências pós-reskin

Depois de fechar a Fase 2, o Felipe perguntou "o que ficou pendente?" —
sobraram dois itens reais, os dois resolvidos:

- **Botões primários**: 8 formulários ainda usavam `<button>` cru com
  classe manual (`bg-primary ...`) em vez do componente `Button` do
  shadcn — visualmente idêntico hoje, mas divergente do padrão adotado no
  resto do sistema. Convertidos: `AtivoForm.tsx`, `MetaForm.tsx`,
  `ContaForm.tsx`, `ImportarFaturaForm.tsx` (2 botões),
  `ImportarImagemForm.tsx`, e os formulários secundários de
  `passivos/[id]/page.tsx` (lançar ciclo de fatura) e
  `ativos/[id]/page.tsx` (vincular a passivo). Botões secundários/de
  texto (remover, marcar quitado, reabrir) foram mantidos como estavam —
  não são o CTA primário do formulário.
- **`/documentos`**: tela nova de histórico — lista todo `Documento` já
  salvo (extrato, fatura, imagem, contrato) com tipo, data de importação
  e contagem de vínculos (transações, passivo-fonte, histórico,
  ciclos de fatura). Cada linha abre um `Sheet` lateral
  (`DocumentoSheet.tsx`) com preview inline do arquivo (PDF via
  `<iframe>`, imagem via `<img>`, ambos apontando pra
  `/api/documentos/[id]` que já existia) e a lista de vínculos. Item
  "Documentos" adicionado ao grupo "Dados" da sidebar.

- **`/transacoes` com `Sheet` de detalhe por linha**: cada linha da tabela
  ganhou um botão "ver" que abre um painel lateral (`TransacaoSheet.tsx`,
  mesmo padrão do `DocumentoSheet.tsx`) com valor em destaque, conta,
  categoria (com a categoria-mãe quando existe), vínculo (passivo / ativo
  / meta), origem do lançamento, e — quando a transação veio de um
  documento importado — o preview inline do PDF/imagem de origem com
  link "abrir em nova aba".

Com isso, as duas pendências levantadas na pergunta anterior do Felipe
("alguma pendência?") estão fechadas — nenhum item conhecido do PRD ou
do reskin ficou pra trás.

## Manutenção de dados — ✅ feito — CRUD que faltava

Nova rodada de "alguma pendência?" — dessa vez uma auditoria funcional
(não visual): o sistema cobria 100% do PRD, mas tinha lacunas reais de
manutenção de dados que iam incomodar no uso contínuo, não no dia 1.
Achadas e resolvidas três (de quatro identificadas — gestão de
categorias ficou de fora por escolha do Felipe):

- **CRUD de `RecorrenciaFinanceira`** (`/recorrencias`): a lacuna mais
  importante. Esse modelo alimenta `calcularMargemLivre`
  (`src/lib/margemLivre.ts`) — a Margem Livre é um número-chave do Mapa
  — mas só existia via `prisma/seed.ts`; não havia nenhuma tela pra
  cadastrar um novo salário, uma assinatura nova, ou desativar uma
  despesa que parou de existir. Nova tela de listagem + formulário
  (criar/editar) + desativar/reativar (`ativa`, sem perder o registro)
  + excluir de verdade. Item "Recorrências" no grupo "Cadastros" da
  sidebar.
- **Editar/excluir transação**: `TransacaoSheet.tsx` ganhou um modo de
  edição inline (descrição, data, valor, tipo, categoria — o essencial
  pra corrigir uma classificação errada de importação) e um botão
  "Excluir transação". Excluir remove primeiro a `AlocacaoMeta`
  vinculada (se houver), depois a transação, numa `$transaction` — sem
  isso, o delete falharia por violação de FK quando a transação era uma
  alocação de meta.
- **Excluir Ativo/Conta/Meta**: Passivo já tinha "marcar quitado"; os
  outros três não tinham nenhuma forma de exclusão — um cadastro feito
  por engano ficava pra sempre. Ativo e Conta bloqueiam a exclusão
  quando há transações vinculadas (`throw new Error` com a contagem, no
  mesmo padrão de validação já usado em `criarConta`/`criarMeta`) — a
  transação (o dinheiro que de fato moveu) não pode desaparecer
  silenciosamente por causa de um cadastro que se quer desfazer. Meta
  sempre pode ser excluída — as cascatas do schema (`MetaPassivo`,
  `AlocacaoMeta`) já cuidam do resto. Nos três casos, `RegraClassificacao`
  (regra de memorização de classificação) é desvinculada (campo posto
  `null`) antes do delete, já que essa referência é opcional.
- Nova `ConfirmForm` (`src/components/ConfirmForm.tsx`): wrapper de
  `<form>` que pede confirmação (`window.confirm`) antes de enviar —
  usado em toda ação destrutiva nova, pra evitar exclusão por clique
  acidental.
- Extraído `ordenarCategoriasHierarquicamente` de
  `ImportarImagemForm.tsx` pra `src/lib/categorias.ts`, já que passou a
  ser usado em três lugares (import por imagem, formulário de
  recorrência, edição de transação).
- Testado à parte antes de entrar em produção: os quatro `delete`
  (incluindo o bloqueio condicional e as cascatas/desvinculações) foram
  exercitados com dados reais descartáveis, criados e apagados num
  script isolado, com o servidor de desenvolvimento desligado durante o
  teste — sem exceção de FK em nenhum caso.

- **Gestão de categorias** (`/categorias`): a quarta lacuna, resolvida
  também. Lista as categorias raiz com as subcategorias indentadas por
  baixo, contagem de vínculos (subcategorias, transações, regras,
  recorrências) por linha, criar/editar (nome + categoria-mãe, só raízes
  entram como opção de mãe — a árvore do sistema é estritamente de 2
  níveis, confirmado nos dados reais antes de implementar) e excluir.
  Exclusão bloqueada (mesmo padrão de erro explicativo de
  Ativo/Conta/Meta) se a categoria tiver subcategoria, transação, regra
  de classificação ou recorrência vinculada — orçamento (`OrcamentoCategoria`)
  já é cascade no schema, então esse cai junto sem problema. Testado à
  parte com dados descartáveis (categoria livre exclui, categoria com
  filho/transação bloqueia, renomear funciona) antes de entrar em uso.
  Item "Categorias" no grupo "Cadastros" da sidebar.

Com essa rodada, as quatro lacunas de manutenção de dados encontradas na
auditoria estão fechadas — não há mais nenhum cadastro no sistema que só
possa ser criado e nunca corrigido ou removido pela interface.

## Categorização em lote + "categorizar depois" — ✅ feito

Feedback do Felipe: quando vem muito lançamento na importação de
extrato, categorizar linha por linha cansa. Pediu duas coisas: selecionar
várias linhas de uma vez pra categorizar juntas, ou então poder
categorizar depois em vez de travar a importação inteira.

- **Tela de revisão do extrato** (`ImportarExtratoForm.tsx`): checkbox
  por linha + "selecionar todos" no cabeçalho da tabela, com uma barra
  de ação (categoria + "Aplicar categoria") que seta a mesma categoria
  em todas as linhas marcadas de uma vez — útil pra várias linhas do
  mesmo tipo (ex.: vários "UBER *TRIP") de uma tacada só.
- **Confirmar sem categorizar tudo**: `handleConfirmar` trocou o
  bloqueio duro ("defina uma categoria antes de confirmar") por um
  aviso opcional (`window.confirm` com a contagem de lançamentos sem
  categoria) — a importação segue mesmo assim se o Felipe confirmar.
  `confirmarImportacaoExtrato` (`src/app/importar/extrato/actions.ts`)
  aceita `categoriaId: null`; a única regra é pular a criação/atualização
  de `RegraClassificacao` pra esses casos, já que esse modelo exige
  categoria (campo obrigatório no schema) — sem categoria não tem o que
  memorizar pra próxima vez.
- **Categorizar depois, em `/transacoes`**: nova tabela client
  (`TransacoesTable.tsx`, extraída de `page.tsx`) com o mesmo padrão de
  checkbox + seleção em massa + aplicar categoria, agora chamando
  `atualizarCategoriaEmLote` (novo em `transacoes/actions.ts`,
  `updateMany` por lista de ids). A página ganhou um filtro "Todas /
  Sem categoria" (`?semCategoria=1`) e um contador fixo de quantas
  transações estão sem categoria no total, sempre visível independente
  do filtro ativo — pra não perder de vista o que ainda falta
  categorizar.
- De brinde: a linha "sugerido por classificação anterior" ainda estava
  com classe Tailwind clara (`bg-blue-50/40`/`text-blue-700`) esquecida
  do reskin — trocada por `bg-gold/[0.06]`/`text-gold`.
- Testado à parte (script isolado, servidor de dev desligado): confirmar
  que uma importação com `categoriaId: null` salva a transação sem
  categoria e não cria `RegraClassificacao`, e que
  `atualizarCategoriaEmLote` de fato atualiza várias transações de uma
  vez (a chamada de `revalidatePath` dentro da action só funciona dentro
  do runtime do Next — falha esperada rodando via `tsx` puro, sem
  relação com a lógica de negócio, que já tinha rodado com sucesso antes
  dela).

## Bug urgente: importação travava em extratos grandes — ✅ corrigido

Ao testar a importação sem categorizar tudo, o Felipe bateu num extrato
real de 220 lançamentos e a confirmação travou com `Unique constraint
failed on the fields: (hashDedupe)`. Investigado e corrigido:

- **Causa raiz**: o dedupe usa uma "impressão digital"
  (`conta+dia+descrição+valor`) marcada `@unique` no banco. Isso
  funciona bem entre importações diferentes, mas tinha um furo: se
  **duas linhas do mesmo extrato** batessem nessa mesma combinação (um
  lançamento de fato repetido no dia, ou uma linha que o parser do PDF
  leu em duplicidade), a primeira gravava normalmente e a segunda
  esbarrava na trava do banco — travando a confirmação inteira no meio
  do laço, sem informar o Felipe do que realmente aconteceu.
- **Correção** (`confirmarImportacaoExtrato`,
  `src/app/importar/extrato/actions.ts`): a criação de cada transação
  agora é protegida por um `try/catch` que reconhece especificamente
  esse erro do Prisma (`Prisma.PrismaClientKnownRequestError` com
  `code === "P2002"`) — quando acontece, a linha é tratada como
  duplicata (pulada, contabilizada) e a importação segue pro resto do
  lote em vez de travar. A action agora retorna `{ importados,
  duplicadosNaConfirmacao }` em vez de só o total.
- Testado à parte (script isolado, servidor de dev desligado): duas
  linhas idênticas no mesmo lote não travam mais — uma é salva, a outra
  é contabilizada como duplicata, sem nenhuma linha perdida nem
  duplicada no banco.
- **De brinde, resposta à segunda pergunta do Felipe** ("pra onde vai
  depois de importar? como sei que importou?"): antes, a tela ficava
  parada em `/importar/extrato` com um textinho discreto de sucesso.
  Agora, ao confirmar com sucesso, redireciona direto pra
  `/transacoes?importados=N&duplicados=M`, que exibe um banner de
  sucesso com as contagens — resposta direta e visual de que a
  importação realmente aconteceu.

## Filtro Receita/Despesa + ordenar por Data/Valor em Transações — ✅ feito

Pedido do Felipe: filtrar a lista de transações por receita/despesa, e
poder ordenar por valor ou por data ("movimentação"), clicando nas
colunas.

- **Filtro Receita/Despesa** (`src/app/transacoes/page.tsx`): nova linha
  de abas "Todas / Receitas / Despesas" (`?tipo=ENTRADA|DESPESA`),
  aplicado direto na query do Prisma (antes do corte de 200 linhas, não
  só no que já tinha sido carregado) — combina com o filtro "Sem
  categoria" já existente sem um anular o outro (`?tipo=DESPESA&semCategoria=1`
  funciona). `hrefComFiltro` monta cada link preservando o outro filtro
  ativo.
- **Ordenar por Data ou Valor** (`TransacoesTable.tsx`): cabeçalho de
  Data e Valor clicável — primeiro clique ordena decrescente, segundo
  clique inverte, com uma setinha indicando a coluna e direção ativas.
  Como a tabela já é client-side (mesmo componente da seleção em lote),
  a ordenação é local (`useMemo` com `.sort`), sem nova consulta ao
  banco.
- Verificado com os dados reais já importados: contagem de "Despesas"
  (108) e "Receitas" (108) bate exatamente com a contagem real no
  banco, e o filtro é aplicado antes do limite de 200 linhas (não corta
  errado quando o total ultrapassa esse teto).

## Consultor — ✅ feito — motor de regras, sem IA generativa

O Felipe perguntou se dava pra ter algo "mais elaborado" que analisasse
entradas/saídas e o direcionasse a pagar ou não um passivo — um
"consultor só pra ele". Decisão tomada junto com ele: em vez de reverter
a arquitetura já escolhida (sinal local grátis + resumo sob demanda pro
Claude, sem custo por uso nem dado saindo da máquina), expandir o motor
de regras existente pra cobrir exatamente esse caso — mesma filosofia,
mais esperto.

- **`src/lib/consultor.ts`** (novo): pra cada passivo ativo, compara a
  taxa de juro (`Passivo.taxaJurosPct`) com uma taxa de referência tipo
  CDI configurável (`Configuracao.taxaReferenciaMensalPct`, novo campo —
  migração `add_taxa_referencia_consultor`) e devolve um veredito:
  "Quitar prioritário" (juro > referência), "Manter mínimo, investir a
  sobra" (juro ≤ referência) ou "Sem dado suficiente" (taxa não
  documentada, com link direto pra editar o passivo e preencher).
  Também calcula uma reserva de emergência alvo (3 meses de despesas
  recorrentes, reaproveitando `margemLivre.despesasRecorrentesCentavos`)
  e sinaliza quando o saldo líquido em conta (soma de todas as contas
  exceto cartão de crédito, cada uma no mínimo zero) está abaixo disso —
  regra clássica de planejador financeiro: não acelerar quitação de
  dívida sem colchão de segurança primeiro.
- **`/consultor`** (novo, grupo "Ferramentas" da sidebar): mostra, nessa
  ordem de prioridade, (1) alerta de cheque especial em uso — reaproveita
  `calcularAlertas`, que ganhou um campo `tipo` (`CHEQUE_ESPECIAL` /
  `FATURA_CRESCENDO` / `SEM_META`) pra permitir filtrar esse alerta
  específico de forma confiável, em vez de casar string no título —,
  sempre tratado como mais urgente que qualquer coisa da lista (juro de
  cheque especial passa de 300% a.a.); (2) status da reserva de
  emergência; (3) aviso se a margem livre estiver zerada/negativa (sem
  fôlego de caixa pra agir agora); (4) formulário pra definir a taxa de
  referência; (5) a lista de vereditos por dívida, ordenada da maior
  taxa de juro pra menor.
- Verificado com os dados reais: "Agiota" (único passivo com taxa
  documentada, 15% a.m.) veio corretamente como "Quitar prioritário"; os
  outros 14 vieram como "Sem dado suficiente"; o banner de reserva de
  emergência bateu a conta certa (R$ 27.373,93 guardado vs. R$ 38.456,40
  de meta, faltam R$ 11.082,47) contra o saldo real da conta.

## Três ferramentas do cardápio de especialistas — ✅ feito

Depois do Consultor, o Felipe perguntou o que ainda faltava das 8
técnicas profissionais listadas antes. Escolheu 3 das 5 que sobraram —
todas encaixadas na infraestrutura que já existia, nada do zero:

- **Score de saúde financeira** (`src/lib/score.ts`, card no topo de
  `/consultor`): 0–100 pontos combinando reserva de emergência (até 30,
  proporcional), margem livre positiva (30), sem cheque especial em uso
  (20) e sem fatura crescendo (20). Faixas: 80+ "Saudável" (liquidity),
  50–79 "Atenção" (gold), abaixo "Crítico" (debt). Verificado com os
  dados reais: 61 pontos ("Atenção") — a conta bate exatamente
  somando os pontos parciais de cada fator hoje (reserva ~71% completa,
  margem livre negativa, sem cheque especial, sem fatura crescendo).
- **Uso de entradas pontuais** (`alocarEntradaPontual` em
  `src/lib/consultor.ts`, formulário "Recebi um valor avulso" em
  `/consultor` via novo `AlocacaoEntradaPontual.tsx`): mesma cascata de
  prioridade do veredito mensal (reserva → dívidas `QUITAR_PRIORITARIO`
  em ordem de taxa → investir a sobra), aplicada a um valor único
  digitado na hora — sem gravar nada, é só simulação client-side.
  `calcularConsultor` passou a carregar também o saldo de quitação
  (`Passivo.valorQuitacaoCentavos`) de cada passivo pra saber até onde
  cada dívida "cabe" na cascata.
- **Projeção multi-mês visual** (`TrajetoriaChart.tsx`, novo, dentro de
  `/otimizacao`): `simularOrdem` (`src/lib/otimizacao.ts`) ganhou um
  campo aditivo, `trajetoriaSaldoTotalCentavos` — o total de saldo
  restante ao final de cada mês simulado, que o loop já calculava
  internamente e só não expunha. Gráfico SVG à mão (mesmo padrão do
  `Termometro.tsx`, sem lib de gráfico) com as 3 estratégias já
  comparadas na tela sobrepostas — liquidity (menor tempo), gold (menor
  juro), tracejado cinza (maior alívio de caixa).
- Testado à parte com funções puras (sem tocar no banco): a cascata de
  entrada pontual aloca corretamente reserva → dívida prioritária →
  sobra pra investir, com a soma batendo com o valor total simulado; o
  score bate 100 num cenário perfeito e 0 num cenário crítico; a
  trajetória de `simularOrdem` tem um valor por mês e termina em zero
  quando a simulação converge.

## As duas últimas do cardápio: renegociação e quitação à vista — ✅ feito

Fechando as 8 técnicas profissionais originais — as 2 que tinham ficado
de fora.

- **Oportunidades de renegociação/portabilidade**
  (`src/lib/renegociacao.ts`, novo, seção em `/consultor`): compara a
  taxa documentada de cada passivo com uma faixa típica de mercado por
  tipo de dívida (`Passivo.tipo` — descobri que já é um slug estável
  tipo `cartao`/`consignado`/`financiamento`, não texto livre, o que
  tornou a comparação confiável). Faixas cobertas: cartão de crédito
  rotativo (10–16% a.m.), capital de giro PJ (2–5%), consignado
  (1,5–2,5%), empréstimo pessoal (4–9%), financiamento (1–1,8%) — valores
  aproximados, explicitamente rotulados na tela como referência geral,
  não dado oficial nem específico do contrato do Felipe (agiota e
  empréstimo informal ficam de fora de propósito, por não terem "taxa de
  mercado" de verdade pra comparar). Quando a taxa real ultrapassa o teto
  da faixa, aparece um aviso sugerindo renegociar ou portar.
- **Simular quitação à vista com desconto**
  (`simularQuitacaoAVista` em `src/lib/consultor.ts`,
  `SimuladorQuitacaoAVista.tsx` novo): escolhe um passivo com saldo
  documentado, informa o desconto oferecido pelo credor, e mostra o
  valor à vista, a economia literal e uma recomendação que reaproveita
  os mesmos sinais de segurança do resto do Consultor (reserva de
  emergência completa + margem livre positiva) — sem projetar juro
  futuro evitado, já que o sistema não tem prazo/amortização
  documentados o suficiente pra essa conta com precisão.
- Testado à parte com funções puras: a faixa de mercado corretamente
  sinaliza só o passivo de teste com taxa acima do teto (18% vs. teto de
  16% pra cartão), ignora o de agiota (sem faixa de comparação) e o sem
  taxa documentada; a simulação de quitação à vista calcula o valor e a
  economia corretos e muda a recomendação conforme reserva/fôlego.
- Com os dados reais do Felipe hoje, a seção de renegociação não
  aparece (só o Agiota tem taxa documentada, e esse tipo é
  propositalmente excluído da comparação) — vai passar a aparecer
  conforme mais passivos tiverem a taxa de juro preenchida.

## Velocímetro no Score de saúde financeira — ✅ feito

O Felipe pediu uma versão gráfica (tipo velocímetro) pro número do
Score, numa versão clean — confirmado com ele: arco preenchido sem
ponteiro nem marcação de escala, não um mostrador tradicional.

- Novo `src/app/consultor/ScoreGauge.tsx`: SVG à mão (mesmo padrão de
  `Termometro.tsx`), um arco semicircular de 180° com trilho de fundo
  (`var(--border)`) e um arco colorido sobreposto, preenchido
  proporcionalmente ao score (técnica de `strokeDasharray`/
  `strokeDashoffset`) — cor muda com a faixa (liquidity/gold/debt, o
  mesmo mapeamento já usado no card). Número grande centralizado dentro
  do arco.
- Substitui o número solto que existia antes no card de score em
  `/consultor`, mesmo `glass-card`.
- Verificado com os dados reais: score 61 (faixa "Atenção") — o arco
  aparece na cor `--gold` e o `strokeDashoffset` bate exatamente com a
  matemática esperada (251,33 × (1 − 0,61) = 98,02).

## Legenda no gauge, "como chegar a 100", e tema claro — ✅ feito

- **Zonas coloridas + legenda no gauge** (`ScoreGauge.tsx`): o trilho de
  fundo agora é desenhado em 3 arcos coloridos (debt/gold/liquidity,
  opacidade baixa) correspondendo às faixas 0–49/50–79/80–100, com uma
  legenda por baixo (3 pontos coloridos + faixa de pontos) — dá pra ver
  em que zona a nota atual cai sem precisar adivinhar.
- **"Como chegar a 100"** (`calcularScoreSaude` em `src/lib/score.ts`
  ganhou `fatores: FatorScore[]`; nova seção em `/consultor`): cada um
  dos 4 componentes do score (reserva, margem livre, cheque especial,
  fatura crescendo) agora tem pontos atuais, pontos máximos, e uma dica
  concreta com link pra tela certa — só lista os fatores que ainda não
  estão no máximo (ou mostra "parabéns" se já for 100). O alerta de
  `FATURA_CRESCENDO` (`src/lib/alertas.ts`) ganhou `passivoId` opcional
  pra poder linkar direto pro passivo específico. Verificado com os
  dados reais: "Reserva de emergência 21/30, faltam R$ 11.082,47" e
  "Margem livre 0/30" batem exatamente com os números já usados nos
  outros cards da mesma tela.
- **Tema claro com alternância**: `src/app/globals.css` separou o bloco
  único `:root, .dark` (dark-only, decisão de reskin anterior) em
  `:root` (paleta clara nova, mesma família de matiz OKLCH da versão
  escura com luminosidade invertida) e `.dark` (bloco escuro, sem
  mudança). Novo `src/components/ThemeToggle.tsx` (botão sol/lua no
  header de `layout.tsx`) alterna a classe `dark` no `<html>` e salva a
  escolha no `localStorage`; um script `next/script`
  (`strategy="beforeInteractive"`, a forma correta do Next.js de injetar
  script que precisa rodar antes da hidratação — um `<script>` inline
  comum gerava aviso de "script tag em componente React") aplica a
  classe antes da primeira pintura, pra não piscar no tema errado.
  Corrigido no caminho: o ícone do toggle só é decidido depois de montar
  no cliente (servidor não tem acesso ao `localStorage`), evitando erro
  de hidratação — usa o padrão "mounted gate" (renderiza lua por padrão
  até montar, só troca pro ícone real depois).
- **Aviso**: não consigo ver a tela renderizada. A paleta clara foi
  implementada com valores OKLCH pensados pra manter o mesmo contraste
  do tema escuro, mas ajuste fino de cor sempre é melhor validado
  olhando de verdade — pedir pro Felipe testar o toggle e apontar
  qualquer token que precise ajustar.

### Bug corrigido: toggle de tema não funcionava (ícone de erro no header)

O Felipe testou o toggle e reportou o botão não fazendo nada + um ícone
de erro vermelho aparecendo. Causa: o mesmo tipo de problema já visto
antes nesta sessão (aviso "1 Issue" do Next.js), agora na tag `<html>`
— o script `beforeInteractive` adiciona a classe `dark` **antes** da
hidratação, então quando o React hidrata ele encontra um `<html>` com
uma classe diferente da que ele mesmo tinha renderizado no servidor,
detecta como erro de hidratação e **descarta/regenera essa parte da
árvore** — o que também desfazia o efeito do toggle. Corrigido com
`suppressHydrationWarning` na própria tag `<html>` em `layout.tsx` —
essa é a forma documentada do React/Next.js de lidar com esse padrão
específico (um script que roda antes de hidratar e altera um atributo
de propósito, não por engano). Verificado: nenhum erro de hidratação
aparece mais no log do servidor de dev depois da correção.

**Segunda rodada — o toggle continuava não funcionando**: a correção
acima resolveu o erro de hidratação, mas o Felipe testou de novo e o
botão continuou sem efeito visível. Causa raiz de verdade, encontrada
comparando o HTML bruto servido (`curl`) antes e depois: o `next/script`
com `strategy="beforeInteractive"` **não estava gerando um `<script>`
estático de verdade** no HTML — no modo dev com Turbopack, o conteúdo do
script ia embutido como dado dentro do payload de streaming do React
(`self.__next_f.push(...)`), que só é processado depois que os chunks
JS carregam de forma assíncrona. Ou seja, o script "que evita o flash"
rodava tarde demais (ou de forma inconsistente) pra realmente evitar
qualquer coisa, e a lógica de leitura do `localStorage` competia com o
próprio ciclo de hidratação de forma imprevisível.

Corrigido trocando `next/script` por um `<script>` literal dentro de
`<head>` em `layout.tsx` (com `dangerouslySetInnerHTML`, mesma
abordagem que eu tinha tentado antes e trocado por engano achando que
`next/script` seria "mais correto"). Verificado desta vez de um jeito
que realmente prova a diferença: inspecionando o HTML bruto retornado
pelo servidor via `curl`, o script agora aparece como uma tag
`<script>` estática de verdade, com o código executável em texto puro
dentro do `<head>`, antes de qualquer chunk JS — exatamente o que
garante execução síncrona no parse da página, antes da primeira
pintura.

## Relatório crítico mensal/semanal + Ajuda do sistema — ✅ feito

- **`/relatorio`** (novo, grupo "Principal" da sidebar): mapa de ações
  pra consulta semanal/mensal, 100% reaproveitando lib já existente —
  `Ação prioritária` automatiza o tipo de análise crítica que eu tinha
  feito na mão sobre a situação real do Felipe (soma as
  `RecorrenciaFinanceira` tipo ENTRADA com `frequencia: UNICA` ativas —
  dinheiro pontual em perspectiva, tipo 13º/campanha/restituição — e
  roda `alocarEntradaPontual` do Consultor nesse total; sem entrada
  pontual, cai pro primeiro veredicto `QUITAR_PRIORITARIO` como
  prioridade estrutural). Também mostra: score de saúde financeira
  (`ScoreGauge`, promovido de `consultor/` pra `src/components/` já que
  agora é usado nas duas telas), progresso de cada meta ativa
  (`calcularProgressoMeta`), maiores ofensores do mês
  (`calcularMaioresOfensores`), e um checklist consolidado (ações
  imediatas + alertas de risco + fatores do score pendentes), cada item
  com link direto pra tela que resolve.
- Verificado com os dados reais: a Ação Prioritária gerada
  automaticamente bateu **exatamente** com a análise que eu tinha feito
  na mão numa conversa anterior — R$ 197.500,00 em entradas pontuais →
  R$ 11.082,47 pra reserva → R$ 172.500,00 pra quitar o Agiota → R$
  13.917,53 de sobra pra investir.
- **Ajuda do sistema**: novo `src/lib/ajudaConteudo.ts` (conteúdo
  escrito documentando as ~19 telas do sistema, organizado pelos mesmos
  grupos do menu lateral) + `src/components/HelpSheet.tsx` (`Sheet`,
  mesmo componente já usado em `DocumentoSheet`/`TransacaoSheet`),
  disparado por um ícone de interrogação no header global
  (`layout.tsx`), ao lado do toggle de tema — acessível de qualquer
  tela do sistema.

## Bug corrigido: campos de valor não aceitavam formato brasileiro

O Felipe tentou digitar "36.085,16" (formato BR: ponto de milhar, vírgula
decimal) no valor de quitação de um passivo, tomou um erro de validação
do próprio navegador (que bloqueia vírgula em `<input type="number">`) e,
ao reabrir o formulário, os valores digitados não tinham sido salvos —
o board nunca chegou a ser enviado. Confirmado pelo log do servidor: não
houve nenhuma tentativa de `POST` malsucedida, ou seja, o problema era
100% no navegador, antes mesmo de chegar no backend.

Causa raiz: todo campo de R$/taxa do sistema usava `<input
type="number">`, que só aceita ponto como decimal e trava com vírgula ou
com separador de milhar — obrigando o usuário a lembrar de digitar
"36085.16" em vez do formato que ele usa a vida toda.

Corrigido de vez, não só documentado:

- **`parseNumeroBR`** (novo, `src/lib/money.ts`): interpreta tanto
  "36.085,16" (BR completo) quanto "36085,16" (só vírgula) quanto
  "36085.16" (formato simples, usado quando o campo é repopulado a
  partir do banco) — regra simples e sem ambiguidade: se tem vírgula,
  ela é o separador decimal e qualquer ponto antes dela é só
  agrupamento de milhar (descartado); sem vírgula, o ponto (se houver)
  é decimal, igual a um número comum.
- **`src/lib/form-helpers.ts`**: `centavosDoForm` e `floatDoForm` (usados
  por toda ação de servidor que recebe R$ ou taxa) passaram a usar
  `parseNumeroBR` em vez de `parseFloat` cru.
- **~20 campos de R$/taxa em ~17 arquivos** trocados de `type="number"`
  pra `type="text" inputMode="decimal"` (mantém teclado numérico no
  celular, mas para de bloquear vírgula/ponto de milhar no navegador) —
  passivos, ativos, metas, contas, recorrências, orçamento por
  categoria, aporte mensal (Mapa, wizard, Ataque rápido, Comparar
  estratégias), Consultor (taxa de referência, entrada pontual,
  desconto à vista), ciclo de fatura, e os 3 fluxos de importação.
  Campos que são contagem inteira de verdade (parcela atual, total de
  parcelas, carência em dias) foram mantidos como `type="number"`
  nessa primeira passada — não têm ambiguidade de formato, então
  pareciam seguros.
- Um caso exigiu mais que trocar o tipo do campo: o editor de valor por
  linha em `/importar/extrato` (`ImportarExtratoForm.tsx`) tinha o
  input controlado e reformatado a cada tecla digitada
  (`value={centavosParaReais(l.valorCentavos)}`) — isso apagaria uma
  vírgula assim que digitada, antes do usuário terminar de escrever os
  centavos. Corrigido trocando pra `defaultValue` (não-controlado),
  deixando o navegador dono do texto enquanto o usuário digita.
- Testado à parte com uma bateria de casos reais (incluindo o valor
  exato que travou pro Felipe, "36.085,16", e um caso de milhões com
  dois pontos de milhar, "1.209.703,03"): todos convertidos
  corretamente pra centavos.

### Segunda rodada: o mesmo aviso apareceu num campo de contagem

O Felipe bateu no mesmo aviso "Digite um valor válido" de novo — dessa
vez no campo "Parcela atual", que tinha ficado de fora da correção
acima por ser tecnicamente uma contagem inteira, não um valor
monetário. Mesmo sendo uma categoria de campo diferente, o efeito pra
quem usa é idêntico: o navegador trava a digitação antes de qualquer
validação do sistema entrar em ação.

Corrigido eliminando `type="number"` do sistema inteiro, não só dos
campos de dinheiro: `parcelaAtual`/`totalParcelas`
(`passivos/PassivoForm.tsx`) e `carenciaDiasChequeEspecial`
(`contas/ContaForm.tsx`) passaram pra `type="text" inputMode="numeric"`
— `intDoForm` (`form-helpers.ts`) já usa `parseInt`, que ignora sozinho
qualquer coisa digitada por engano depois de um separador, então não
precisou mudar a lógica de parse, só parar de deixar o navegador
bloquear a digitação antes disso. Confirmado por grep: zero ocorrências
de `type="number"` em qualquer formulário do sistema.

## Gastos essenciais de cartão → limite recomendado — ✅ feito

O Felipe quer saber qual o limite mínimo que realmente precisa ficar
liberado em cada cartão, baseado nos gastos que não podem parar de
existir (assinatura, seguro etc.) — pra poder pedir pro banco reduzir
o resto sem correr o risco de precisar desbloquear às pressas. Pediu
pra reaproveitar o cadastro de Recorrências pra marcar isso, e também
poder marcar direto na importação de extrato.

- **Schema**: `RecorrenciaFinanceira` ganhou `essencial` (boolean) e
  `passivoId` (em qual cartão é cobrada); `Passivo` ganhou
  `limiteCartaoCentavos` (limite de crédito atualmente liberado,
  documentado só pra cartões). Migração aditiva, mesmo padrão já usado
  nas anteriores.
- **`/recorrencias`**: `RecorrenciaForm` ganhou o campo "Cartão"
  (opcional, lista os passivos `tipo: "cartao"` ativos) e o checkbox
  "Essencial (não pode parar de existir)". A lista mostra o cartão
  vinculado e um selo dourado "essencial" quando marcado.
- **Marcar direto na importação** (o pedido extra do Felipe, além do
  que eu tinha planejado): cada linha da revisão em
  `/importar/extrato` ganhou um checkbox "Essencial". Ao confirmar,
  `confirmarImportacaoExtrato` cria ou atualiza automaticamente a
  `RecorrenciaFinanceira` correspondente — dedupe pela mesma chave
  normalizada já usada em `RegraClassificacao`
  (`normalizarDescricao`), então reimportar a mesma assinatura em
  meses diferentes (com datas diferentes na descrição) atualiza o
  valor em vez de duplicar. Se a linha já estiver vinculada a um
  passivo (cartão), esse vínculo vai junto automaticamente.
- **`/limite-cartao`** (novo, grupo "Ferramentas"): lista todo cartão
  ativo lado a lado, com a soma das recorrências essenciais vinculadas,
  um campo pra informar/editar o limite atual liberado, e a
  comparação — "pode pedir pra reduzir até R$X sem afetar nenhum gasto
  essencial" ou o aviso oposto, se o limite já estiver abaixo do
  necessário.
- Testado à parte (script isolado, servidor de dev desligado): marcar
  uma linha como essencial cria a recorrência certa; reimportar a
  "mesma" assinatura num mês diferente (data diferente na descrição,
  valor reajustado) atualiza a recorrência existente em vez de
  duplicar; o cartão vinculado enxerga a recorrência essencial
  corretamente.

## Importação de fatura linha a linha — ✅ feito

O Felipe perguntou por que a importação de fatura de cartão original
(seção do PRD) só trazia total/mínimo/vencimento, sem limite de crédito
nem as compras individuais — confirmei que o PRD nunca chegou a
especificar isso (só "limite utilizado", nunca "limite total", e nunca
transação por transação) e ele aprovou estender a importação de fatura
pra revisar compra por compra, igual já funciona em `/importar/extrato`,
principalmente pra poder marcar gasto essencial de cartão em cima de
lançamentos reais em vez de só de memória.

- **Preparação (refactor sem mudança de comportamento)**:
  `calcularHashDedupe` (`src/lib/classificacao.ts`) generalizou o
  parâmetro `contaId` pra `origemId`, já que agora tanto uma conta
  (extrato) quanto um passivo/cartão (fatura) podem ser a "fonte" de um
  lançamento pra fins de dedupe. A lógica de confirmar um lançamento
  importado (tratar duplicata, criar `AlocacaoMeta`, aprender
  `RegraClassificacao`, marcar `RecorrenciaFinanceira` essencial) foi
  extraída pra um helper único, `confirmarLancamentoClassificado`
  (`src/lib/confirmarLancamento.ts`), usado agora tanto por
  `confirmarImportacaoExtrato` quanto pela nova confirmação de fatura —
  pra não deixar as duas importações divergirem nesse comportamento.
  Testado à parte antes de seguir: nenhuma regressão na importação de
  extrato.
- **`src/lib/fatura-parser.ts`** ganhou `parseLinhasFatura`, no mesmo
  espírito do parser de extrato: reconhece linhas no formato
  "DD/MM descrição valor", sugere `ENTRADA` quando o valor vem negativo
  (estorno) e `DESPESA` no resto, ignora linhas de resumo (total,
  subtotal, limite, vencimento, número de página), e nunca descarta
  silenciosamente uma linha com data que não bateu no formato — ela
  aparece como "não reconhecida" pra revisão manual.
  - Não há PDF real de fatura em mãos, então (igual ao parser de total
    já existente) não há garantia de que o layout bate com o de todos
    os bancos — o objetivo é nunca inventar nem travar, e sempre expor
    o que não foi reconhecido.
- **`/importar/fatura`**: `analisarFatura` passou a também extrair e
  devolver as linhas de compra (com dedupe contra o histórico do
  próprio cartão via `origemId`, e sugestão de categoria/essencial
  quando já existe uma `RegraClassificacao` ou `RecorrenciaFinanceira`
  com aquele nome). Nova ação `confirmarImportacaoFatura` grava as
  transações usando o helper compartilhado (`passivoId` do cartão,
  `origem: FATURA_IMPORTADA`). A tela ganhou uma segunda seção — tabela
  de revisão linha a linha (data, descrição, valor, tipo, categoria,
  essencial), separada do formulário de totais da fatura que já
  existia (que continua alimentando o ciclo de fatura do cartão).
- Testado à parte (script isolado, servidor de dev desligado): parser
  reconhece corretamente despesas e estornos e reporta a linha não
  reconhecida; confirmar o mesmo lote duas vezes trata a segunda como
  duplicata em vez de duplicar ou travar; marcar uma linha como
  essencial cria a `RecorrenciaFinanceira` vinculada ao cartão certo, e
  a linha não marcada não cria recorrência nenhuma. `npx tsc --noEmit`
  e `npm run lint` limpos; servidor de dev reiniciado do zero,
  `/importar/fatura` e `/importar/extrato` respondendo 200 sem erros no
  log.

## Fluxo do mês: confirmado vs projetado vs saídas conhecidas — ✅ feito

Auditoria do PRD a pedido do Felipe ("Falta mais alguma coisa?") achou
uma lacuna real: a seção 4.4 pede que o dashboard mostre o fluxo do mês
separando confirmado, projetado e saídas conhecidas, sempre com
distinção visual entre fato e estimativa — o card de "Margem livre
mensal" no Mapa só mostrava um número final, com a estimativa citada
numa nota de rodapé. Felipe aprovou construir isso agora.

- **`src/lib/margemLivre.ts`**: `calcularMargemLivre` ganhou
  `margemConfirmadaCentavos` — o fluxo só com entradas confirmadas menos
  as saídas conhecidas (despesas recorrentes + parcelas dos passivos +
  aporte de quitação), sem nenhuma entrada estimada. O
  `margemLivreCentavos` que já existia continua igual (confirmado +
  estimado) e passou a representar o "projetado". Mudança puramente
  aditiva — todo o resto do sistema (relatório, consultor, sinal de
  risco, resumo) continua lendo `margemLivreCentavos` sem alteração de
  comportamento.
- **Mapa (`/`)**: o card virou "Fluxo do mês", mostrando confirmado e
  projetado lado a lado (o projetado só aparece quando existe alguma
  entrada estimada, com estilo visualmente distinto — itálico, cor
  mais apagada, separado por uma borda tracejada, com uma bolinha
  verde/dourada indicando fato vs estimativa) e uma lista com as
  saídas conhecidas discriminadas (despesas recorrentes, parcelas dos
  passivos, aporte de quitação), em vez de só citadas na legenda.
- Testado à parte (script isolado, sem tocar banco): confirmado e
  projetado batem quando não há entrada estimada; com entrada
  estimada, confirmado nunca inclui a estimativa e a diferença entre
  os dois é exatamente o valor estimado. `npx tsc --noEmit` e
  `npm run lint` limpos; servidor de dev reiniciado do zero, `/`,
  `/relatorio` e `/consultor` respondendo 200 sem erros no log.

## Classificação inteligente, reclassificação em lote e ofensor por credor — ✅ feito

Antes de importar um extrato bem mais longo que os últimos 60 dias, o
Felipe pediu três coisas conectadas: (1) que a importação reconheça
padrões parecidos com o que ele já categorizou, não só bata exato — e que
isso valha pra fatura de cartão também; (2) um jeito de achar e
reclassificar em lote transações parecidas depois de criar subcategorias
novas (exemplo dele: toda entrada de R$250 é sempre doação/dízimo, mas a
descrição do PIX varia por remetente); (3) entender de verdade se o
Agiota ou o Cartão de crédito pesou mais historicamente, já que ele
suspeita que em meses anteriores o cartão foi o ofensor maior.

- **Sugestão "aproximada" na importação** (`sugerirClassificacao` em
  `src/lib/classificacao.ts`): antes, `analisarExtrato`/`analisarFatura`
  só sugeriam categoria quando a descrição normalizada batia **exatamente**
  com uma `RegraClassificacao`/`RecorrenciaFinanceira` já aprendida — duas
  variações do mesmo credor (ex: "UBER *TRIP..." vs "UBER *EATS...") viravam
  regras completamente não relacionadas. Agora, se não bate exato, o
  sistema tenta uma aproximação por sobreposição de palavras (Jaccard,
  limiar de 60% de similaridade e pelo menos 2 palavras em comum, pra não
  casar por causa de uma palavra genérica isolada). As duas importações
  (extrato e fatura) passaram a chamar essa mesma função, então a melhoria
  vale pras duas automaticamente. Nas telas de revisão, uma sugestão
  aproximada aparece com um aviso diferente da sugestão exata ("sugestão
  aproximada — confira") — o valor continua pré-preenchido e editável,
  nada é aplicado sem revisão.
- **Reclassificar em lote depois de organizar categorias**: a seleção
  múltipla + "aplicar categoria em lote" já existia em `/transacoes`
  (`TransacoesTable.tsx`); o que faltava era achar o grupo. A página
  ganhou filtro por **descrição** (contém, em memória) e por **valor
  exato** (`parseNumeroBR`) — resolve direto o caso do Felipe: filtrar
  "valor = 250,00" pra achar todas as entradas de dízimo/doação de uma vez,
  não importa a descrição do PIX — além de um filtro por categoria atual.
  O dropdown de aplicar categoria em lote ganhou "+ Criar nova
  subcategoria…" inline (mesmo padrão já usado na importação de extrato),
  pra criar a subcategoria e já reclassificar o grupo selecionado numa
  única ação.
- **Fechando o ciclo de aprendizado**: toda reclassificação manual — em
  lote (`atualizarCategoriaEmLote`) ou individual
  (`atualizarTransacao`) — agora também ensina uma `RegraClassificacao`
  (`aprenderRegraClassificacao`, extraído do que já existia em
  `confirmarLancamento.ts`). Ou seja: quanto mais o Felipe reclassificar
  agora que vai reorganizar as categorias, melhor fica a sugestão
  automática do próximo extrato ou fatura importado — fecha o loop entre
  as duas primeiras partes.
- **Ofensor real por credor + tendência mensal** (`src/lib/ofensores.ts`):
  `calcularMaioresOfensores` só agrupava por categoria, num período fixo
  ancorado em hoje — não respondia com confiança "Agiota ou Cartão pesou
  mais". Como `Transacao.passivoId` já vincula o lançamento ao credor real
  quando classificado com esse vínculo (e a importação de fatura vincula
  **toda** compra ao cartão automaticamente), a nova
  `calcularOfensoresPorCredor` agrupa por credor em vez de categoria. A
  nova `calcularTendenciaMensal` monta uma série mês a mês (top 5 credores
  ou categorias + "Outros"), renderizada num gráfico SVG novo
  (`TendenciaMensalChart.tsx`, mesmo estilo do gráfico de trajetória da
  otimização). `/ofensores` ganhou um alternador "Por categoria" / "Por
  credor" e um período novo, "Todo o histórico" — juntos, respondem
  visualmente se o cartão dominou em alguns meses e o Agiota em outros.
- Testado à parte: `sugerirClassificacao` (função pura) — match exato
  vence aproximado, variação de 1 token casa como aproximada, descrição
  sem nada em comum não casa, recorrência essencial sugerida via match
  exato; script isolado (servidor de dev desligado, dados descartáveis)
  confirmando que reclassificar em lote e individualmente aprende a regra
  certa por padrão único de descrição, e que `calcularOfensoresPorCredor`/
  `calcularTendenciaMensal` batem com um cenário sintético de 2 credores
  em 2 meses com a ordem invertida (cartão dominando um mês, Agiota
  dominando o outro). `npx tsc --noEmit` e `npm run lint` limpos; servidor
  de dev reiniciado do zero, `/transacoes` (com e sem filtros),
  `/ofensores` (`visao=credor&periodo=tudo`), `/importar/extrato`,
  `/importar/fatura`, `/importar/imagem` e `/categorias` respondendo 200
  sem erros no log.

## Achar credores parecidos pra reclassificar em lote — ✅ feito

Complemento direto da Parte 2 acima: o Felipe queria filtrar/achar em
`/transacoes` não só por valor exato, mas também por **credor
parecido** — porque no extrato real existem lançamentos do mesmo credor
com descrição levemente diferente (nome truncado pelo banco, texto
extra no final etc.), que não se encontram nem pelo "contém" nem por
valor exato. Fui conferir dados reais antes de desenhar, e achei
exatamente esse padrão: `PGTO PROTECAO FAMILIAR` e
`PGTO PROTECAO FAMILIAR MES 09/26` são o mesmo seguro, mas strings
diferentes.

- **`src/lib/classificacao.ts`**: `tokenizar`/`similaridadeJaccard` (já
  usadas internamente por `sugerirClassificacao`, da Parte 1) ganharam
  uma função exportada, `calcularSimilaridadeDescricao(a, b)` — mesma
  conta, reaproveitada em vez de duplicada.
- **`/transacoes`**: novo parâmetro `parecido=1`, que muda o filtro de
  descrição de "contém" (texto literal) pra "parecido com" (similaridade
  por sobreposição de palavras) — limiar mais permissivo (0.4) que o da
  sugestão automática de importação (0.6), porque aqui é o Felipe
  revisando visualmente o resultado, não uma sugestão aplicada sozinha.
  Cada linha encontrada por aproximação mostra um selo "parecido X%",
  calculado e exibido de verdade (confirmado com os dados reais do
  Felipe: "PGTO PROTECAO FAMILIAR" e sua variante bateram 75%, dentro do
  limiar). Um checkbox "credor parecido" ao lado do campo de busca liga
  esse modo.
- **`TransacoesTable.tsx`**: cada linha ganhou a ação "achar parecidos",
  que navega direto pra `/transacoes?tipo=...&q=<descrição da linha>&parecido=1`
  — um clique a partir de qualquer transação já existente, sem precisar
  redigitar o nome do credor.
- A seleção múltipla + aplicar categoria em lote (com "+ criar nova
  subcategoria" e aprendizado automático de `RegraClassificacao`) não
  mudou — o filtro por credor parecido só melhora como o grupo é
  encontrado antes de usar essa mesma ação já existente.
- Testado à parte: `calcularSimilaridadeDescricao` contra os dois casos
  reais achados no banco — o par "PROTECAO FAMILIAR" ficou em 0.75
  (acima do limiar), e um par de dois cartões Itaú genuinamente
  diferentes ("FATURA ITAU PERSON VS INFIN" vs "FATURA ITAU UNICLASS MC
  BLA") ficou em 0.25 (corretamente abaixo). `npx tsc --noEmit` e
  `npm run lint` limpos; servidor de dev reiniciado do zero,
  `/transacoes?q=PGTO+PROTECAO+FAMILIAR&parecido=1` testado direto contra
  o banco real — voltou exatamente as duas transações esperadas, com
  `semelhancaPct` 100% e 75%.

## Sugestão por valor histórico na importação — ✅ feito

O Felipe perguntou, antes de importar um extrato de 90+ dias, se as
próximas importações já cairiam na categoria certa do jeito que ele já
categorizou. Resposta honesta: por descrição (igual ou parecida) sim,
mas faltava o caso original que motivou o filtro por valor em
`/transacoes` — **mesmo valor, credor totalmente diferente** (ex: toda
entrada de R$250 é doação, mas o nome de quem faz o PIX muda). Antes de
propor, fui checar se isso é seguro de automatizar: agrupei todas as
transações já categorizadas por `(valor, tipo)` e vi que quase todo
valor repetido já foi classificado de um jeito **100% consistente** —
toda ENTRADA de R$250 (22 ocorrências), R$900 (13), R$4.500 (8) etc.
sempre virou "Religião - Receita". Em toda a base, só um par (valor,
tipo) já foi usado de dois jeitos diferentes (R$2.085,07 em DESPESA) —
e é justamente esse tipo de ambiguidade que a regra abaixo precisa
reconhecer e não arriscar.

- **`src/lib/classificacao.ts`**: `sugerirClassificacao` ganhou um
  terceiro nível de sugestão — depois de tentar exata e aproximada por
  descrição (sem achar nada), tenta o **valor histórico**: nova função
  `calcularHistoricoPorValor()` varre todas as transações já
  categorizadas, agrupa por `(valorCentavos, tipo)` e devolve só as
  combinações **unânimes** (uma única categoria pra aquele valor+tipo,
  com pelo menos 2 ocorrências) — um valor que já foi classificado de
  dois jeitos diferentes nunca entra nesse mapa, então nunca vira
  sugestão. `SugestaoClassificacao.origem` ganhou o valor `"valor"` pra
  marcar esse nível, o mais fraco dos três.
- **`analisarExtrato`/`analisarFatura`**: chamam
  `calcularHistoricoPorValor()` uma vez por análise e repassam pra
  `sugerirClassificacao` de cada linha — mesma função usada pelos dois
  fluxos, então a melhoria vale pra extrato e fatura automaticamente.
- **Telas de revisão**: linha sugerida só por valor ganha um terceiro
  estilo (mais discreto que "aproximada") com o aviso "sugestão por
  valor — esse valor sempre foi classificado assim antes, confira com
  atenção" — nada é aplicado sem revisão, igual às outras origens.
- Testado à parte: função pura confirmando a prioridade exata >
  aproximada > valor (mesmo quando mais de uma bateria de dados
  existir ao mesmo tempo), que valor ambíguo nunca sugere nada, e que
  o mesmo valor com tipo diferente (DESPESA vs ENTRADA) não casa;
  `calcularHistoricoPorValor` testado com dados descartáveis
  reproduzindo o padrão real (3 ocorrências unânimes entram no mapa,
  2 ocorrências divergentes ficam de fora, 1 ocorrência única também
  fica de fora por não bater o mínimo de 2). `npx tsc --noEmit` e
  `npm run lint` limpos; servidor de dev reiniciado do zero,
  `/importar/extrato`, `/importar/fatura` e `/transacoes` respondendo
  200 sem erro no log.

## Gráfico de trajetória por ofensor (saldo e gasto, passado e futuro) — ✅ feito

O Felipe pediu, embaixo de cada ofensor na visão "por credor" de
`/ofensores`, um gráfico mostrando a queda do saldo devedor ao longo do
tempo — pra enxergar exatamente onde ele "começa a respirar melhor"
(Agiota cai de uma vez, empréstimo/cartão vão abatendo aos poucos). Ele
reforçou: quer isso numa linha só, combinando passado e futuro, e
também pediu que a "Tendência mensal" (gasto) ganhasse o mesmo
tratamento. E apontou uma lacuna real nos gráficos que já existiam: só
desenhavam a linha, sem number nenhum visível por ponto.

- **`src/lib/otimizacao.ts`**: `ResultadoEstrategia` ganhou
  `trajetoriaPorPassivoCentavos` — a mesma simulação mês a mês que já
  existia (`trajetoriaSaldoTotalCentavos`), agora exposta por passivo
  individual, não só a soma. A lógica já existente trata os 3
  comportamentos certos pela `estrutura` do passivo: Agiota
  (`SO_JUROS_SEM_AMORTIZACAO`) fica achatado até a poupança acumulada
  bater o saldo e cai de uma vez; empréstimo/cartão
  (`AMORTIZA_NORMAL`) cai todo mês.
- **`src/lib/ofensores.ts`**: nova `calcularTrajetoriaRealPassivo` lê o
  `PassivoHistorico` (`campo: "valorQuitacaoCentavos"`, já gravado toda
  vez que o Felipe atualiza um passivo) e devolve a série real de saldo
  ao longo do tempo. `calcularTendenciaMensal` ganhou um parâmetro
  opcional de projeção: na visão "por credor", cada série de gasto
  mensal continua além do mês atual com o `custoMensalCentavos` do
  passivo até o mês em que ele quita na rota já escolhida
  (`encontrarOrdemMenosJuros`, reaproveitada de `estadoAtual.ts`, mesma
  rota usada no Mapa) — histórico real e projeção futura na mesma
  série, não em gráficos separados.
- **Números de verdade em cima da linha**: novo componente
  compartilhado `src/components/GraficoLinhaTemporal.tsx` — usado agora
  pelos três gráficos de linha do app
  (`TrajetoriaChart.tsx` em `/otimizacao`, `TendenciaMensalChart.tsx` e
  o novo `TrajetoriaCredorChart.tsx` em `/ofensores`). Cada ponto tem
  `title` nativo do SVG (mostra "label — R$valor" ao passar o mouse),
  os pontos-chave (início, "hoje"/começo da projeção, fim) têm o valor
  escrito do lado, e uma tabela dobrável ("ver valores") lista todo
  ponto → R$ numa lista só, passado e futuro juntos. Gráfico de saldo
  (que é uma "foto" a cada mês, não algo que faz sentido somar) não
  mostra mais o total do período — só o de gasto mensal (que é fluxo)
  continua mostrando.
- **`/ofensores`**: na visão "por credor", cada ofensor que é um
  passivo de verdade ganha o novo gráfico de saldo devedor embaixo
  (real sólido até hoje, projetado tracejado dali em diante, com "quita
  em N meses" quando aplicável).
- Bug pego e corrigido durante o teste: `<title>` do SVG com múltiplos
  filhos JSX (`{a} — {b}{c}`) quebra a hidratação no React — corrigido
  pra usar um único template string. Só apareceu porque testei de
  verdade contra o servidor rodando, não só `tsc`/`lint`.
- Testado à parte: função pura confirmando o comportamento binário do
  Agiota (achatado até cair de uma vez) vs gradual do empréstimo, e que
  a soma das trajetórias por passivo bate com o total já existente;
  `calcularTrajetoriaRealPassivo` com histórico real vira série
  cronológica correta, sem histórico devolve o ponto único; extensão de
  `calcularTendenciaMensal` confirmando histórico real + projeção futura
  constante até a quitação na mesma série. Ponta a ponta com dados
  descartáveis (passivo, config de aporte, histórico e transação de
  teste): a página `/ofensores?visao=credor` renderizou o gráfico com
  os números certos (real R$7.000→R$5.000, projeção caindo R$300/mês
  até quitar em 17 meses — batendo com a conta manual, já que o aporte
  extra estava todo comprometido com dívidas reais maiores primeiro),
  tudo limpo depois. `npx tsc --noEmit` e `npm run lint` limpos;
  servidor de dev reiniciado do zero, `/ofensores`,
  `/ofensores?visao=credor`, `/otimizacao` e `/` respondendo 200 sem
  erro no log.
- Não dá pra testar visualmente o hover do tooltip por aqui — vale o
  Felipe conferir na tela se o balão aparece ao passar o mouse num
  ponto do gráfico.

## Menor juro vs mais fácil de sair — escolha explícita, não mais decidida sozinha — ✅ feito

O Felipe fez uma provocação importante: o sistema tava sempre priorizando
menor juro (Agiota primeiro, por ser o que mais sangra), mas isso é mais
difícil de executar na prática — um passivo binário (`SO_JUROS_SEM_AMORTIZACAO`)
não dá crédito parcial, o saldo fica parado até o valor inteiro ser
acumulado, enquanto um empréstimo (`AMORTIZA_NORMAL`) cai um pouco a
cada mês. Confirmei que ele tinha razão: `src/lib/estadoAtual.ts` sempre
usava `encontrarOrdemMenosJuros` (a estratégia de menor juro) como "a"
rota propagada pro Mapa, pro Consultor e pro gráfico de saldo por
credor — nunca perguntando ao Felipe qual critério ele prefere, e nunca
medindo o custo em paciência de cada escolha.

- **Duas métricas novas em `ResultadoEstrategia`** (`src/lib/otimizacao.ts`):
  `mesesAteAlivioVisivel` (quantos meses até a primeira quitação da
  estratégia) e `mesesNoEscuro` (por passivo binário, quantos meses ele
  fica com saldo parado antes de cair de uma vez) — a segunda é a
  métrica que traduz em número exatamente a reclamação do Felipe.
- **Estratégia híbrida** (`simularOrdemComSplit`, a parte criativa do
  pedido): em vez de jogar 100% do aporte extra num passivo por vez,
  divide por percentual entre o "mais difícil" (quem mais sangra juro
  sem dar crédito parcial) e o "mais fácil" (menor saldo entre os que
  amortizam) — dá alívio visível todo mês sem abrir mão de atacar o
  mais caro. `montarOrdemHibrida` decide os dois alvos automaticamente
  a partir dos passivos elegíveis.
- **`/otimizacao`** ganhou um 4º cartão ("híbrida", com um slider de
  divisão percentual), cada cartão agora mostra o mês do 1º alívio
  visível e um aviso quando algum passivo fica muitos meses "no
  escuro", e um botão "usar esse critério no Mapa e no Consultor" por
  cartão.
- **`Configuracao`** ganhou `estrategiaEscolhida` e `splitHibridoPct`
  (migração `estrategia_escolhida_hibrida`) — `src/lib/estadoAtual.ts`
  passou a montar a rota "oficial" de acordo com a escolha do Felipe
  (`escolherEstrategia`, novo ponto único de tradução), com "menor
  juro" como padrão só enquanto nada for escolhido, pra não mudar o
  comportamento de quem já usa o app. Isso propaga automaticamente pra
  trilha do Mapa e pro gráfico de saldo por credor em `/ofensores`, sem
  precisar mexer nessas telas de novo.
- Testado à parte: função pura confirmando que menor juro ataca o
  Agiota e o deixa "no escuro" por vários meses, que menor tempo dá
  alívio já em poucos meses, e que a híbrida também dá alívio rápido
  (o lado amortizante recebe sua fatia) mesmo destinando parte do
  aporte ao mais caro; `escolherEstrategia` testado mapeando cada
  string de estratégia pra função certa, com fallback seguro pra menor
  juro quando a híbrida não tem os dois tipos de passivo necessários.
  Ponta a ponta com dados descartáveis: escolher "menorTempo" via a
  action de verdade mudou a ordem devolvida por `carregarEstadoAtual()`
  (a mesma função usada pelo Mapa e por Ofensores), e escolher
  "híbrida" 70/30 persistiu certinho e deu alívio visível rápido,
  batendo com a conta manual. `npx tsc --noEmit` e `npm run lint`
  limpos; servidor de dev reiniciado do zero, `/otimizacao`, `/`,
  `/ofensores`, `/ofensores?visao=credor` e `/consultor` respondendo
  200 sem erro no log.

## Limite de tamanho de upload — ✅ feito

O Felipe gerou um extrato de 90 dias pra importar e tomou
"Body exceeded 1 MB limit" — o Next.js limita o corpo de uma Server
Action a 1MB por padrão (pensado pra formulário comum, não upload de
PDF), e ele quer importar um do primeiro semestre inteiro, ainda maior.

- **`next.config.ts`**: `experimental.serverActions.bodySizeLimit: "20mb"`
  — vale globalmente pras três importações que sobem arquivo do mesmo
  jeito (`analisarExtrato`, `analisarFatura`, `confirmarLancamentoImagem`),
  não só extrato.
- Verificado: servidor de dev reiniciado do zero (mudança de
  `next.config.ts` não é hot-reload), log confirmou o novo limite
  carregado ("Experiments (use with caution): · serverActions");
  `npx tsc --noEmit` limpo; `/importar/extrato`, `/importar/fatura` e
  `/importar/imagem` respondendo 200 sem erro no log.
- Não dá pra testar por aqui se um PDF de 90+ dias de verdade passa —
  vale o Felipe tentar de novo o upload e confirmar.

## /transacoes escondia histórico em silêncio — ✅ feito (bug)

O Felipe importou o extrato maior (depois do limite de upload
corrigido) e perguntou por que não via todo o histórico em
`/transacoes`. Causa confirmada direto no banco: a base já tinha 1.420
transações (jan-set/2026), e a página buscava com
`orderBy: { data: "desc" }` cortando em `take: 200` sempre que não
havia busca por texto/valor ativa — só os 200 mais recentes apareciam,
e o cabeçalho mostrava "200 lançamento(s)" como se fosse o total, sem
nenhum aviso dos outros 1.220 escondidos.

- **Corte de 200 removido** pra navegação normal — 1.420 linhas com os
  relacionamentos incluídos não pesa pra SQLite local nem pra
  renderizar numa tabela; era uma precaução prematura. O corte
  continua existindo só como salvaguarda pra busca aproximada/valor em
  memória (`q`/`valor`/`parecido`), que ainda pode devolver muita coisa
  parecida.
- **Nunca mais em silêncio**: quando o corte de busca aproximada
  realmente entra em ação, a página agora avisa explicitamente
  ("mostrando só os N mais relevantes de M encontrados") em vez de só
  mostrar o número truncado como se fosse o total.
- **Filtro por período** (reaproveitando `Periodo`/`inicioDoPeriodo` de
  `src/lib/ofensores.ts`, mesmo padrão já usado em `/ofensores`): novo
  seletor "Este mês / Trimestre / Este ano / Todo o histórico", default
  "todo o histórico" — dá pro Felipe navegar por período além da busca
  por texto/valor que já existia.
- Verificado direto com os dados reais: `/transacoes` sem filtro passou
  a mostrar "1420 lançamento(s)" (o total de verdade, batendo com a
  contagem no banco) em vez de "200"; `/transacoes?periodo=mes`
  restringiu corretamente pro mês atual. `npx tsc --noEmit` e
  `npm run lint` limpos; servidor de dev reiniciado do zero,
  `/transacoes` (com e sem período) respondendo 200 sem erro no log.

## Fechar o vínculo entre histórico e decisões — ✅ feito

O Felipe sentiu que o sistema "não usa o histórico" e cogitou que
precisava de IA pura pra analisar os dados. Antes de aceitar essa
premissa, fui direto no banco: 1.420 transações importadas, **zero**
vinculadas a passivo/ativo/meta, 29% ainda sem categoria, e só 3 dos 15
passivos ativos já tiveram o saldo atualizado desde o cadastro (vários
nem têm saldo documentado). Ou seja: Otimização, Consultor e a trilha
do Mapa nunca "ignoraram" o histórico por falta de inteligência — eles
literalmente nunca receberam os dados conectados, porque o vínculo
nunca foi feito. Uma IA generativa recebendo os mesmos dados
desconectados chegaria à mesma conclusão vazia. Perguntei diretamente
ao Felipe se ele queria fechar esse buraco de dados (sem custo, sem
enviar dado pra fora — mantendo a decisão já tomada nesta sessão de não
usar IA paga) ou reconsiderar essa decisão; ele confirmou: fechar o
vínculo primeiro.

- **Vincular em lote** (`atualizarVinculoEmLote`, novo em
  `src/app/transacoes/actions.ts`): o toolbar de seleção múltipla em
  `/transacoes`, que já aplicava categoria em lote, ganhou o mesmo pra
  vínculo (Passivo/Ativo/Meta) — junto com o filtro "credor parecido"
  já existente, é como o Felipe destrava retroativamente os 1.420
  lançamentos: busca "NUBANK", seleciona tudo, vincula ao passivo
  certo, de uma vez. Vincular a uma meta cria/atualiza a
  `AlocacaoMeta`; trocar de vínculo limpa o anterior.
- **Reconciliação de saldo** (`calcularReconciliacaoPassivo`, novo em
  `src/lib/passivoReconciliacao.ts`): soma as transações vinculadas a
  um passivo desde a última vez que o saldo foi confirmado (via
  `PassivoHistorico`, ou desde o cadastro se nunca foi) e sugere o novo
  saldo. Nova seção "Pagamentos vinculados" em `/passivos/[id]` lista
  as transações vinculadas e, quando há pagamento não refletido, mostra
  um formulário pré-preenchido com o saldo sugerido — um clique
  confirma, reaproveitando a ação `atualizarPassivo` que já existe (já
  grava em `PassivoHistorico` sozinha).
- **Painel "Qualidade dos dados"** em `/relatorio`
  (`calcularQualidadeDados`, novo em `src/lib/qualidadeDados.ts`):
  mostra quantas transações estão sem categoria/sem vínculo (com link
  direto pra resolver — `/transacoes` ganhou o filtro `semVinculo`,
  simétrico ao `semCategoria` que já existia) e a lista de passivos
  cujo saldo nunca foi confirmado desde o cadastro (independente de há
  quantos dias — um cadastro recente não devia mascarar isso) ou
  desatualizado há mais de 60 dias, cada um linkando direto pro
  passivo.
- **"O que mudou"**, também em `/relatorio`
  (`calcularMaioresVariacoes`, novo em `src/lib/ofensores.ts`):
  reaproveita `calcularTendenciaMensal` já existente (sem reconstruir
  análise do zero) pra comparar os dois últimos meses com dado real de
  cada categoria e destacar as maiores variações em R$ — a "análise dos
  dados que você colocou" que faltava, sem precisar de IA nenhuma pra
  isso.
- Testado à parte: `atualizarVinculoEmLote` (vincular a passivo seta
  certo, vincular a meta cria `AlocacaoMeta`, trocar de vínculo limpa o
  anterior); `calcularReconciliacaoPassivo` (sem pagamento vinculado
  não sugere nada; com pagamento sugere o valor certo; ENTRADA vinculada
  não conta como pagamento); `calcularMaioresVariacoes` (ignora meses
  projetados, ordena pela maior variação em R$, não em %). Ponta a
  ponta com dados descartáveis: vincular em lote → reconciliação sugere
  o saldo certo → `atualizarPassivo` grava e reconciliação para de
  sugerir depois de confirmado — o ciclo completo funcionando. Bug real
  pego nesse teste ponta a ponta (limiar de 60 dias não pegava passivo
  "nunca atualizado" quando o cadastro é recente) e corrigido antes de
  fechar. `npx tsc --noEmit` e `npm run lint` limpos; servidor de dev
  reiniciado do zero, conferido contra os dados reais: painel de
  qualidade mostrou "414 de 1420" sem categoria e "1420 de 1420" sem
  vínculo (batendo com a auditoria inicial), e a lista de passivos
  nunca atualizados apareceu certa depois da correção.

## Grupos sugeridos + empréstimo recebido não é receita — ✅ feito

Com 1.420 transações pra revisar, o Felipe pediu o oposto de buscar
credor por credor: o sistema já chegar com os grupos prontos (descrição
parecida ou valor repetido) num modal, pra aplicar em lote. Ele também
levantou um ponto certo: todo desembolso de empréstimo (ex: consignado)
aparece como `ENTRADA` no extrato, igual a qualquer PIX recebido — sem
tratamento, isso passa a impressão de que sobrou dinheiro no mês quando
é dívida nova entrando. Conferi no banco real e achei 3 lançamentos
"CREDIARIO ITAU" de R$132.500, R$68.290 e R$37.200 confirmando que o
caso é real, não hipotético.

- **Motor de agrupamento** (`src/lib/agrupamentoTransacoes.ts`, função
  pura): agrupa por descrição idêntica primeiro (mais confiável), depois
  tenta encaixar descrições parecidas num grupo já formado comparando
  só contra um representante fixo por grupo (evita o problema clássico
  de transitividade — A parecido com B, B com C, A nada a ver com C), e
  por último agrupa o que sobrou por valor+tipo repetido — o padrão
  "toda entrada de R$250 é doação, nome de quem manda muda". Descarta
  grupo que já não tem nada a resolver (mesma categoria e vínculo em
  todo mundo).
- **Botão + modal em `/transacoes`**: "Ver sugestões de agrupamento",
  nova server action `buscarGruposSugeridos` (respeita o filtro de
  tipo/período/categoria já ativo na tela) abre um `Sheet` listando
  cada grupo com categoria/vínculo sugeridos (editáveis) e um botão
  "aplicar a esse grupo" que usa os mesmos `atualizarCategoriaEmLote`/
  `atualizarVinculoEmLote` já existentes — grupo aplicado some da lista
  sem fechar o modal.
- **Agrupamento no ato da importação**: `ImportarExtratoForm.tsx` e
  `ImportarFaturaForm.tsx` agora rodam o mesmo motor sobre as linhas do
  próprio lote (tudo em memória, nada gravado ainda) — linha com
  "colegas" parecidas no lote ganha um atalho "aplicar a N linha(s)
  parecida(s) do lote", pra já entrar tudo certo sem precisar arrumar
  depois.
- **Empréstimo recebido não é receita**: `calcularReconciliacaoPassivo`
  passou a olhar os dois sentidos — `DESPESA` vinculada reduz o saldo
  (pagamento), `ENTRADA` vinculada aumenta (desembolso de empréstimo,
  antes ficava silenciosamente ignorada). Em `/transacoes` e
  `/passivos/[id]` ("Pagamentos vinculados" virou "Movimentações
  vinculadas"), uma `ENTRADA` vinculada a um passivo não usa mais o
  verde de receita — vira cor de dívida com o rótulo "empréstimo
  recebido", pra nunca mais parecer, de relance, que sobrou dinheiro.
  Conferido (não precisou mexer): `calcularMargemLivre` e as duas
  funções de ofensores já não somam `ENTRADA` bruta de jeito nenhum.
- Testado à parte: `encontrarGruposSugeridos` com os casos reais já
  confirmados nesta sessão (PROTECAO FAMILIAR por descrição, R$250 por
  valor) formando grupo certo, os dois cartões Itaú diferentes
  continuando separados, grupo já resolvido e transação sem par não
  aparecendo; `buscarGruposSugeridos` respeitando o filtro de período;
  `calcularReconciliacaoPassivo` com os dois sentidos (só desembolso
  aumenta o saldo sugerido; pagamento + desembolso no mesmo passivo
  calcula o líquido certo). `npx tsc --noEmit` e `npm run lint`
  limpos; servidor de dev reiniciado do zero, `/transacoes`,
  `/importar/extrato`, `/importar/fatura`, `/passivos/[id]`,
  `/relatorio`, `/ofensores`, `/otimizacao` e `/` respondendo 200 sem
  erro no log.
- Não dá pra testar visualmente a abertura do modal/sheet nem o clique
  nos botões "aplicar a esse grupo" por aqui — vale o Felipe conferir
  na tela.

## Sheet lateral sem scroll — ✅ feito (bug)

O Felipe relatou ficar preso num Sheet (painel lateral) sem conseguir
rolar nem fechar. Causa direta em `src/components/ui/sheet.tsx`: o
painel (`SheetPrimitive.Popup`) é `fixed` com altura travada, mas o
conteúdo nunca esteve dentro de um contêiner com `overflow-y-auto` —
quando o conteúdo é mais alto que a tela (o "Ver sugestões de
agrupamento" recém-criado, com vários grupos, é o caso mais provável de
ter disparado isso), ele simplesmente transborda sem barra de rolagem
nenhuma. Como é um componente compartilhado, as três telas que usam
Sheet (`HelpSheet`, `TransacaoSheet`, `GruposSugeridosSheet`) herdavam
o mesmo problema.

- Corrigido só no componente compartilhado: `{children}` (cabeçalho +
  corpo de cada tela) passou a ficar dentro de um contêiner interno
  (`flex-1 min-h-0 overflow-y-auto`), e o botão de fechar ficou como
  irmão **fora** desse contêiner — se eu tivesse só colocado
  `overflow-y-auto` no painel inteiro, o botão de fechar rolaria junto
  com o conteúdo e sumiria de vista ao rolar pra baixo, trocando um
  problema por outro. Com o botão fora do contêiner que rola, ele fica
  sempre fixo no canto superior direito, não importa o quanto role.
- Nenhuma mudança necessária nas três telas que já usam Sheet — a
  correção vale pra elas (e qualquer Sheet futura) automaticamente.
- Registrado também: a tecla Esc já fecha qualquer Sheet por padrão
  (confirmado no código do Base UI) — uma saída imediata se travar de
  novo antes dessa correção, ou em qualquer cenário parecido no futuro.
- `npx tsc --noEmit` e `npm run lint` limpos; servidor de dev
  reiniciado do zero, `/transacoes` respondendo 200 sem erro no log.
  Limitação honesta: o conteúdo de um Sheet só é montado no DOM quando
  aberto (Base UI não renderiza o Popup fechado), então não dá pra
  confirmar via `curl` na página fechada que as classes novas
  aparecem — só dá pra verificar abrindo de verdade no navegador. Vale
  o Felipe confirmar que consegue rolar até o fim e ainda ver/clicar o
  botão de fechar, tanto no "Ver sugestões de agrupamento" quanto no
  detalhe de uma transação com documento anexado.

## Ícone de erro do Next mostrando 2 problemas — ✅ feito (bug)

O Felipe reportou 2 avisos no indicador de dev do Next. Achei no log do
servidor: os 2 eram a mesma mensagem do Base UI repetida — "componente
agindo como botão esperava um não-\<button\>, porque `nativeButton` é
false". Causa: `src/app/transacoes/GruposSugeridosSheet.tsx` (recém
criado) tinha `<SheetTrigger render={<Button ... nativeButton={false} />}>`
— só que esse `Button` não tem nenhum `render` próprio, então renderiza
um `<button>` de verdade mesmo, contradizendo o `nativeButton={false}`
que eu passei. `nativeButton={false}` só faz sentido quando o `Button`
está sendo redirecionado pra um elemento que não é `<button>` (é assim
que já é usado em todo o resto do app, sempre junto com
`render={<Link .../>}` — conferi que `TransacaoSheet.tsx` e
`HelpSheet.tsx`, que abrem Sheet do mesmo jeito, já estavam certos).

- Corrigido removendo o `nativeButton={false}` indevido — sem mexer em
  mais nada.
- `npx tsc --noEmit` e `npm run lint` limpos; servidor de dev
  reiniciado do zero, `/transacoes` respondendo 200 e sem o aviso no
  log.

## Despesa/receita visível nas sugestões + confirmação da lógica de ofensor — ✅ feito

O Felipe perguntou duas coisas: (1) se as sugestões de agrupamento
distinguem despesa de receita, e (2) se "ofensor" no relatório é
mesmo só "quem tirou dinheiro" e nunca "quem deu crédito" (ou seja,
um desembolso de empréstimo não pode inflar o ranking de ofensores).

A segunda pergunta já estava respondida no código: `calcularMaioresOfensores`,
`calcularOfensoresPorCredor` e `calcularTendenciaMensal`
(`src/lib/ofensores.ts`) sempre filtram `tipo: "DESPESA"` — uma
transação `ENTRADA` (incluindo desembolso de empréstimo vinculado a
um Passivo) nunca entra nesse cálculo. Nenhuma mudança de código
necessária, só confirmação.

A primeira revelou uma lacuna real, mas só na exibição: o agrupamento
em `src/lib/agrupamentoTransacoes.ts` já separava despesa de receita
corretamente (a chave de cada grupo sempre inclui o `tipo`, então
DESPESA e ENTRADA nunca se misturam num mesmo grupo) — só que isso
era invisível no Sheet, que sempre mostrava o total em vermelho sem
nenhuma indicação de natureza.

- `src/lib/agrupamentoTransacoes.ts`: `GrupoSugerido` ganhou o campo
  `tipo`, preenchido a partir do primeiro membro do grupo (todo grupo
  já é homogêneo em tipo).
- `src/app/transacoes/GruposSugeridosSheet.tsx`: cada card agora
  mostra um rótulo — "despesa" (vermelho) para `DESPESA`, "empréstimo
  recebido" (vermelho, mesma convenção de `TransacoesTable.tsx` e
  `passivos/[id]/page.tsx`) quando é `ENTRADA` vinculada a um Passivo,
  ou "receita" (verde) nos demais casos de `ENTRADA` — inclusive
  reagindo em tempo real se o Felipe trocar o vínculo escolhido antes
  de aplicar.
- `npx tsc --noEmit` e `npm run lint` limpos; teste isolado
  (`scratch-test-tipo-grupo.ts`, descartado depois) confirmou que
  despesa, empréstimo (ENTRADA+PASSIVO) e receita genuína (ENTRADA sem
  vínculo) — mesmo com descrição/valor repetidos entre eles — ficam em
  grupos distintos, cada um com o `tipo` correto; `/transacoes`
  respondendo 200. Não deu pra confirmar visualmente o rótulo dentro
  do Sheet (Base UI só monta o conteúdo do Dialog quando aberto, e não
  há navegador real disponível aqui) — vale o Felipe conferir na
  prática.

## "Grupos sugeridos" sempre voltava com tudo — ✅ feito (bug)

O Felipe notou que, toda vez que abria "ver sugestões de
agrupamento", o painel voltava com a mesma quantidade de grupos de
sempre, como se nada do que ele já tinha resolvido antes contasse.
Causa: em `src/lib/agrupamentoTransacoes.ts`, um grupo só saía da
lista quando NENHUM membro "faltava resolver", e "faltar resolver"
exigia categoria E vínculo (Passivo/Ativo/Meta) preenchidos. Só que
vínculo não é (nem deveria ser) algo que toda transação precisa ter —
confirmei relendo a seção "Fechar o vínculo entre histórico e
decisões" deste roadmap e o schema: vínculo só se aplica a
pagamento/desembolso de dívida, aporte em ativo ou alocação de meta.
Um gasto comum (mercado, transporte, lazer) nunca vai ter vínculo, e
isso é normal — mas a checagem antiga tratava essa ausência
permanente como "pendente" pra sempre, então assim que o Felipe
categorizava um grupo comum, ele continuava voltando porque "faltava
vínculo" nunca deixava de ser verdade.

- `src/lib/agrupamentoTransacoes.ts`: a checagem de "falta resolver"
  agora só cobra vínculo quando o próprio grupo já dá evidência de que
  ele se aplica — isto é, quando `vinculoSugerido` já existe (algum
  membro já vinculado a um Passivo/Ativo/Meta). Sem esse sinal, basta
  categoria em todos os membros pra considerar o grupo resolvido. Isso
  segue a mesma premissa que `vinculoSugerido` já tinha (propagar um
  vínculo conhecido pros parecidos, nunca inventar um do zero) — só
  que agora aplicada também ao critério de "já resolvido".
- Não muda o fluxo de vincular pela primeira vez um grupo de dívida
  ainda não linkado a nenhum Passivo — isso continua sendo feito
  manualmente em `/transacoes` (busca "credor parecido" + toolbar de
  vínculo em lote), como já era antes.
- Testado isolado (`scratch-test-grupo-persiste.ts`, descartado
  depois): grupo comum sem vínculo aplicável some assim que
  categorizado; grupo com vínculo conhecido em só 1 membro continua
  aparecendo mesmo com categoria preenchida, até todos os membros
  terem o mesmo vínculo; o mesmo grupo, com vínculo completo, some.
  `npx tsc --noEmit` e `npm run lint` limpos; `/transacoes`
  respondendo 200.

## Crédito/débito óbvio nas sugestões de agrupamento — ✅ feito

O Felipe confirmou que a dificuldade era especificamente no painel
"ver sugestões de agrupamento": olhando os cards, não dava pra saber
se um grupo era crédito (receita) ou débito (despesa), o que tornava
difícil escolher a categoria certa. O rótulo de natureza que eu tinha
adicionado numa correção anterior era só um texto cinza de 10px, fácil
de passar batido — e o `<select>` de categoria continuava mostrando a
lista inteira, tipo-agnóstica, sem nenhuma pista de qual categoria
fazia sentido pra despesa vs. receita (confirmei que `Categoria` no
schema não tem campo `tipo` — a base de categorias até contorna isso
na unha, com uma "Religião - Receita" e uma "Religião - Despesa"
separadas como raízes distintas).

- `src/lib/categorias.ts`: nova função pura
  `calcularTipoPredominantePorCategoria` — a partir de uma contagem
  categoria×tipo, devolve o tipo mais frequente já lançado em cada
  categoria (categoria nunca usada fica de fora do mapa, sem sinal
  nenhum, nunca escondida por engano).
- `src/app/transacoes/page.tsx`: nova query em paralelo
  (`prisma.transacao.groupBy` por categoria e tipo) alimenta essa
  função; o mapa resultante (`tipoPorCategoria`) vira nova prop do
  `GruposSugeridosSheet`.
- `src/app/transacoes/GruposSugeridosSheet.tsx`: o rótulo de natureza
  virou um selo (pill) — mesmo padrão visual já usado em
  `src/app/consultor/page.tsx` (`VEREDICTO_CLASSES`), reaproveitado em
  vez de inventar um novo estilo — com fundo/borda tingidos, impossível
  de não notar. O `<select>` de categoria agora esconde, por grupo, as
  categorias cujo tipo predominante conhecido diverge do tipo do grupo
  (categoria já escolhida/sugerida nunca é escondida, mesmo se
  divergir, pra não invalidar o `value` do select).
- Testado isolado (`scratch-test-tipo-categoria.ts`, descartado
  depois): categoria só usada em DESPESA retorna DESPESA; categoria
  usada nos dois tipos retorna o de maior contagem; categoria nunca
  usada fica fora do mapa. `npx tsc --noEmit` e `npm run lint`
  limpos; `/transacoes` respondendo 200 (exercitando de fato a nova
  query `groupBy` contra o banco real).

## "Fluxo do mês" negativo x saldo real positivo — diagnóstico, não bug

O Felipe importou um extrato novo, ficou com saldo real positivo de
R$10.922,96 no banco, mas o "Meu Mapa" mostrava "Fluxo do mês:
Confirmado" em -R$27.547,26 e "Você deve R$1.317.953,07 hoje" —
perguntou se era erro de classificação ou bug. Investiguei a fundo
(`src/lib/estadoAtual.ts` → `src/lib/margemLivre.ts`) e conferi cada
número contra o banco real: todos batem exatamente, e nenhum vem do
extrato importado. "Entradas confirmadas", "Despesas recorrentes" e
"Parcelas dos passivos" somam `RecorrenciaFinanceira` cadastradas e o
`custoMensalCentavos` de todos os 15 passivos ativos — um orçamento
teórico ("se eu pagasse tudo que devo, todo mês, sobraria isso"), não
uma reconciliação do que realmente aconteceu na conta. `prisma.transacao`
nunca é consultado nessa cadeia de cálculo. Não é bug: o Felipe
certamente não paga o custo mensal cheio das 15 dívidas (ele mesmo já
tinha levantado isso sobre o Agiota — "não estou amortizando nada"),
então esse "confirmado" negativo é esperado dentro da lógica atual —
só o rótulo não deixava isso óbvio.

- `src/app/(mapa)/page.tsx`: sem mexer em nenhum cálculo, só texto.
  O parágrafo explicativo do card "Fluxo do mês" ganhou uma frase fixa
  sempre visível ("Baseado nas recorrências e no custo mensal das
  dívidas que você cadastrou — não é o extrato do banco importado.");
  a linha "Patrimônio líquido atual" ganhou o mesmo tipo de
  esclarecimento no parênteses que já existia ("... ; não é o saldo
  da sua conta bancária").
- `npx tsc --noEmit` e `npm run lint` limpos; `curl` na Home
  confirmando 200 e as duas frases novas presentes no HTML
  renderizado.

## Saúde dos cartões: várias faturas de uma vez, meta de gasto e histórico + tendência — ✅ feito

O Felipe quer entender a saúde dos cartões (já identificados como
grandes ofensores), com histórico de gastos e uma visão de futuro,
podendo ajustar metas de uso e categorizar na importação. Investiguei
antes de propor: importar fatura + categorizar por linha já existia
(`/importar/fatura`, com sugestão automática e agrupamento pra aplicar
em lote); gráfico de histórico+projeção também já existia em
`/ofensores`, só que cartões apareciam misturados com todos os
credores e a projeção era "moldada pra empréstimo" (paga um valor fixo
até zerar — não faz sentido pra cartão revolvente). "Meta de uso" não
existia em lugar nenhum. Perguntei e o Felipe confirmou: quer subir
várias faturas de uma vez, meta como um valor fixo de gasto mensal
(não percentual de limite), e o "futuro" do cartão como média dos
últimos meses de gasto real (não uma data de quitação).

- **Importar várias faturas de uma vez**
  (`src/app/importar/fatura/ImportarFaturaForm.tsx`): sem mudar as
  server actions (`analisarFatura`/`confirmarImportacaoFatura`
  continuam recebendo 1 arquivo/1 documento por chamada) — o input de
  arquivo ganhou `multiple`, o form chama `analisarFatura` uma vez por
  arquivo sequencialmente, e a revisão de compras virou uma tabela só
  com todas as linhas de todas as faturas juntas (cada linha guarda o
  `documentoId` de origem, mostrado numa coluna "Fatura" quando há mais
  de uma). O agrupamento de linhas parecidas (`encontrarGruposSugeridos`,
  sem mudança) agora cruza faturas diferentes — uma assinatura que
  aparece em 6 meses de fatura cai no mesmo grupo, aplicando categoria
  a todas de uma vez. A seção "Totais da fatura" (que grava em
  `CicloFaturaPassivo`) se repete uma vez por fatura enviada. Ao
  confirmar, as linhas são agrupadas por `documentoId` e
  `confirmarImportacaoFatura` é chamada uma vez por grupo, somando os
  totais.
- **Meta de gasto mensal por cartão**: novo campo
  `Passivo.metaGastoMensalCentavos` (migração
  `meta_gasto_mensal_cartao`, mesmo padrão nullable do
  `limiteCartaoCentavos` já existente — sem restringir por tipo no
  schema, só por convenção de uso). Nova action
  `definirMetaGastoMensal` em `src/app/limite-cartao/actions.ts`,
  espelhando exatamente `definirLimiteCartao`; `/limite-cartao` ganhou
  um segundo mini-form por cartão pra definir essa meta.
- **Nova página `/cartoes` ("Saúde dos cartões")**: nova função pura
  `calcularHistoricoComTendenciaCartao` em `src/lib/ofensores.ts` —
  soma DESPESA por mês de um passivo nos últimos 6 meses (real) e
  projeta mais 3 meses na média dos últimos 3 meses **com gasto**
  (ignora mês de fatura zerada pra não puxar a média artificialmente
  pra baixo; sem nenhum gasto real, não projeta nada — sem divisão por
  zero). A página lista cada cartão ativo com: gasto do mês atual vs.
  meta (barra de progresso reaproveitando o mesmo estilo já usado em
  `/ofensores/page.tsx` pros orçamentos por categoria) e o gráfico de
  histórico+tendência reaproveitando `TendenciaMensalChart` direto
  (zero componente novo de gráfico — já tinha tooltip, rótulo de
  pontos e tabela de valores via `GraficoLinhaTemporal`). Novo item de
  navegação "Cartões" em `src/components/AppSidebar.tsx`.
- Testado isolado (`scratch-test-historico-cartao.ts`, com passivos e
  transações descartáveis, limpos ao final e conferidos por contagem
  antes/depois — 15 passivos e 1428 transações intactos): cartão com 4
  meses de gasto real gera 6 meses reais (2 zerados + 4 com valor) e 3
  projetados na média dos últimos 3 meses com gasto; cartão sem nenhum
  gasto não gera projeção nenhuma. `npx tsc --noEmit` e `npm run lint`
  limpos; `curl` em `/importar/fatura`, `/limite-cartao` e `/cartoes`
  confirmando 200 e o HTML renderizado com o texto novo de cada tela.

## Detectar parcelamento na fatura + "Próximas parcelas" em /cartões — ✅ feito

O Felipe notou que, ao importar uma fatura, uma compra parcelada
(ex: "MAGAZINE LUIZA 02/10") aparece só como uma linha do mês — sem
nenhum jeito de ver que ainda faltam 8 parcelas de R$150 nos próximos
meses. Conferi: `src/lib/fatura-parser.ts` sempre capturou a descrição
inteira como texto solto, sem interpretar "02/10"; não existia nenhum
campo em `Transacao` (só em `Passivo`, que documenta o progresso do
empréstimo em si, não de uma compra específica) pra guardar "isso é a
parcela X de Y"; e a projeção de `/cartões` é puramente estatística
(média dos últimos meses), sem como injetar um valor já sabidamente
compromissado. Perguntei e o Felipe confirmou: quer uma lista separada
"Próximas parcelas" em `/cartões`, sem misturar com a linha de
tendência estatística do gráfico.

- **Detecção no parser** (`src/lib/fatura-parser.ts`): nova
  `detectarParcela(descricao)` reconhece os formatos mais comuns de
  fatura brasileira — rotulado ("PARC 2/5", "PARC. 02/10", "PARCELA
  2/5") ou solto no fim da descrição ("02/10") — só considera
  parcelamento de verdade quando `total >= 2` e `atual <= total`
  ("1/1" não conta). Segue o mesmo espírito "melhor palpite, nunca
  inventado" do resto do parser: `parseLinhasFatura` passa a incluir
  `parcelaSugerida` em cada candidato, sempre como sugestão editável.
- **Schema**: `Transacao` ganhou `parcelaAtual`/`totalParcelas`
  (migração `parcela_transacao`), mesmo nome/padrão nullable já usado
  em `Passivo`, agora por lançamento individual. `confirmarLancamentoClassificado`
  (`src/lib/confirmarLancamento.ts`, compartilhado com o import de
  extrato) passou a aceitar e gravar os dois campos.
- **Revisão da importação** (`ImportarFaturaForm.tsx`): nova coluna
  "Parcela" na tabela de compras — um campo de texto livre ("2/10"),
  pré-preenchido quando detectado, sempre editável (vazio = não é
  parcelado).
- **"Próximas parcelas" em `/cartões`**: nova função pura
  `calcularParcelasAbertas` (`src/lib/parcelasFuturas.ts`) — busca
  transações com parcela em aberto (`parcelaAtual < totalParcelas`).
  Como a mesma compra pode ser importada em mais de uma fatura (mês 1
  traz "2/10", mês 2 traz "3/10"), agrupa por descrição normalizada
  (`normalizarDescricao` já remove os dígitos, então "2/10" e "3/10"
  caem na mesma chave) + valor + total de parcelas, e usa só o
  registro de maior parcela — evita contar as parcelas restantes em
  dobro. Pra cada compra em aberto, calcula quantas parcelas faltam, o
  valor restante e em quais meses futuros cada uma cai. Nova seção na
  página, abaixo do gráfico de cada cartão, com essa lista e o total
  ainda comprometido — separada da tendência estatística, como
  combinado.
- Testado isolado: `detectarParcela` contra 9 casos (rotulado, solto,
  "1/1" rejeitado, sem padrão, atual > total rejeitado); `calcularParcelasAbertas`
  com dados descartáveis (limpos ao final, 15 passivos/1445 transações
  intactos antes e depois) confirmando que a mesma compra importada
  duas vezes usa só a parcela mais recente (sem duplicar), parcela já
  quitada não aparece, e os meses futuros batem. `npx tsc --noEmit` e
  `npm run lint` limpos. Bug real pego só depois da migração: o
  servidor de dev já estava rodando de uma sessão anterior e continuou
  com o Prisma Client antigo em memória mesmo após `npx prisma migrate
  dev` regenerar os arquivos — `/cartoes` respondia 500 ("Unknown
  argument `totalParcelas`") até reiniciar o servidor do zero; depois
  do restart, `/importar/fatura`, `/cartoes`, `/limite-cartao`,
  `/transacoes` e `/` responderam 200. Não deu pra confirmar visualmente
  a coluna "Parcela" nem a seção "Próximas parcelas" via curl — a
  tabela de revisão só existe depois de um upload de PDF (interação de
  cliente) e nenhum cartão real do Felipe tem parcela em aberto ainda
  (recurso novo) — vale ele conferir na prática ao importar a próxima
  fatura.

## Apagar um documento importado (fatura/extrato) — ✅ feito

O Felipe tinha duas faturas importadas que queria desfazer (pra
reimportar corrigido) e não tinha como — confirmei que `/documentos`
só oferecia "ver" o arquivo, sem excluir, e o único delete existente no
sistema era `excluirTransacao`, por transação individual, um clique de
cada vez. Conferi o schema: `Transacao.documentoId` e
`CicloFaturaPassivo.documentoId` são opcionais sem `onDelete`
explícito, então apagar um `Documento` direto (sem tratamento) só
desvincularia essas linhas (`SetNull` automático do Prisma) em vez de
apagá-las — o que também bloquearia reimportar depois, já que a
deduplicação da fatura compara contra todas as transações do banco,
sem filtrar por documento. Perguntei e o Felipe confirmou: apagar o
documento deve desfazer a importação inteira (transações + totais do
ciclo de fatura + arquivo).

- Nova action `excluirDocumento` (`src/app/documentos/actions.ts`,
  novo arquivo) — mesmo padrão de `excluirTransacao`
  (`src/app/transacoes/actions.ts`): apaga em ordem, numa
  `$transaction`, `AlocacaoMeta` das transações do documento (não
  cascade sozinho), depois `CicloFaturaPassivo`, depois as
  `Transacao`, depois o `Documento`; por fim remove o arquivo físico
  (tolerando arquivo já ausente) e revalida `/documentos`,
  `/transacoes`, `/cartoes` e `/limite-cartao`. Referências que citam
  o documento sem fazer parte da importação (`Passivo.documentoFonteId`,
  `PassivoHistorico.documentoId`) não precisam de tratamento manual — o
  Prisma já desvincula sozinho ao apagar o `Documento`, sem apagar o
  passivo nem o histórico.
- `src/app/documentos/DocumentoSheet.tsx`: novo botão "Excluir" (mesmo
  padrão de confirmação de `TransacaoSheet.tsx` — `window.confirm`
  antes de chamar a action), reaproveitando a lista de vínculos que a
  tela já calculava (`documento.vinculos`) pra avisar exatamente o que
  vai junto ("5 transação(ões), 1 ciclo(s) de fatura..."). O Sheet
  virou controlado (`open`/`onOpenChange`) pra fechar sozinho depois de
  excluir com sucesso.
- Testado isolado (`scratch-test-excluir-documento.ts`, com passivo,
  documentos, transações e ciclo de fatura descartáveis, tudo limpo ao
  final e conferido por contagem antes/depois — 15 passivos e 1445
  transações intactos): apaga as transações e o ciclo do documento
  alvo sem tocar num documento/transação de controle; confirma que o
  `hashDedupe` da compra apagada fica livre de novo (reimportar não
  seria mais bloqueado como duplicata). `npx tsc --noEmit` e
  `npm run lint` limpos; `/documentos` respondendo 200. Não deu pra
  confirmar visualmente o botão "Excluir" via curl — só existe dentro
  do Sheet, que só monta ao abrir (interação de cliente) — vale o
  Felipe conferir na prática.

## Histórico mensal por categoria em "Maiores ofensores" — ✅ feito

O Felipe apontou um problema real de design em `/ofensores`: o ranking
por categoria (`calcularMaioresOfensores`) soma **todo o período
selecionado** num único total — então pra ver a "Tendência mensal"
(que já existia mais abaixo na página) era preciso trocar o período pro
"Ano" ou "Todo o histórico", e aí os blocos do topo passavam a somar o
ano/tudo inteiro num só número, perdendo a foto de cada mês. Ele
resumiu bem: "vou ter a soma de tudo, não a fotografia de cada mês".
Achei também uma inconsistência que confirma o diagnóstico: na visão
"por credor" cada bloco já ganha, embaixo, um gráfico próprio de
histórico (`TrajetoriaCredorChart`) — na visão "por categoria", onde o
Felipe estava (olhando "Moradia"), nenhum bloco tinha gráfico nenhum.

- Nova função pura `calcularHistoricoMensalCategoria` em
  `src/lib/ofensores.ts` — soma DESPESA por mês de uma categoria raiz
  (raiz + subcategorias, mesma regra de agregação que
  `calcularMaioresOfensores` já usa) nos últimos 12 meses **fixos**,
  sempre, independente do período escolhido no topo da página. Sem
  projeção futura — aqui é só olhar pra trás.
- `src/app/ofensores/page.tsx`: na visão "por categoria", cada bloco do
  ranking ganha esse gráfico embaixo (mesmo padrão de
  `Promise.all` já usado pra buscar as trajetórias de credor),
  reaproveitando `TendenciaMensalChart` direto — zero componente novo,
  já vem com tooltip por mês, rótulo de valor nos pontos e tabela
  expansível "ver valores".
- Isso resolve as duas partes do pedido ao mesmo tempo: o bloco do
  topo continua mostrando o total exato do período escolhido (ex:
  "Moradia: R$X este mês"), e agora sempre aparece junto um gráfico com
  o valor gasto mês a mês nos últimos 12 meses, sem precisar trocar
  filtro nenhum pra ver a tendência.
- Testado isolado (`scratch-test-historico-categoria.ts`, com
  categoria raiz+subcategoria e transações descartáveis, limpos ao
  final): gasto na raiz e gasto na subcategoria somam corretamente no
  mesmo mês da raiz; transação de 13 meses atrás (fora da janela de
  12) corretamente excluída; 12 pontos sempre retornados, com zero nos
  meses sem gasto. `npx tsc --noEmit` e `npm run lint` limpos;
  `/ofensores` respondendo 200 com o rótulo "Últimos 12 meses"
  presente no HTML renderizado (dados reais).

## Comparativo mensal em barras + tabela — ✅ feito (revisão do item anterior)

O Felipe testou a correção anterior (linha solta por categoria) e
apontou, com razão, que não ajudava: uma linha sozinha não compara
nada com nada, os valores só apareciam no hover, e ele não conseguia
comparar "cartão de crédito" com "empréstimo" nem ver o total de cada
categoria como legenda. Reverti o gráfico solto (removido de
`src/app/ofensores/page.tsx` e `calcularHistoricoMensalCategoria`
apagada de `src/lib/ofensores.ts`, sem uso depois da reversão) e usei
o skill de dataviz do Claude Code pra decidir o formato certo em vez
de tentar no olho: pra "diferenciar e comparar séries" o guia indica
barra agrupada com cor categórica e legenda sempre visível a partir de
2 séries, e pra esse volume de dado (até 6 séries × 12 meses)
recomenda tabela junto do gráfico — exatamente o que faltava.

- **Paleta categórica validada** — `src/app/globals.css` ganhou
  `--chart-1` a `--chart-5` (light + dark), com os hex do skill de
  dataviz. Rodei `validate_palette.js` do skill contra as cores reais
  do tema (resolvi os tokens OKLCH pra hex e testei contra a
  superfície de gráfico deste app, luz e escuro): a paleta ad hoc que
  já existia (`var(--debt)`/`var(--gold)` + hex soltos) falhava dois
  testes de daltonismo (contraste insuficiente de "Outros" e par
  dourado/vermelho indistinguível pra deuteranopia); a paleta padrão
  do skill passa em tudo nos dois modos. Os aliases `--color-chart-N`
  (que já existiam no `@theme inline`, sem uso real antes) agora
  apontam pra essas variáveis de verdade. "Outros" usa a cor neutra de
  texto secundário, de propósito — não é uma categoria de verdade.
- **Novo componente `GraficoComparativoMensal`**
  (`src/app/ofensores/GraficoComparativoMensal.tsx`): barras agrupadas
  por mês (uma barra por ofensor, lado a lado, topo arredondado/base
  quadrada — regra do skill), tooltip nativo por barra, **legenda
  sempre visível** com nome + total do período por série, e uma
  **tabela completa logo abaixo** (ofensor × mês, sempre visível, sem
  esconder atrás de hover ou de "ver valores") — reaproveita o mesmo
  tipo `SerieMensal` que `calcularTendenciaMensal` já produzia, sem
  mudar essa função.
- `src/app/ofensores/page.tsx`: a seção agora chama
  `calcularTendenciaMensal` com uma data fixa de 12 meses atrás (não
  mais o filtro de período do topo) e sem projeção — essa comparação é
  só histórica; a projeção de saldo devedor por credor continua
  existindo, sem mudança, no gráfico individual de cada credor.
- Testado isolado (`scratch-test-comparativo-mensal.ts`, com 3
  categorias e transações descartáveis, valores propositalmente bem
  acima de qualquer dado real pra garantir que não caíssem em
  "Outros"): soma de cada série bate exatamente com o gasto lançado
  (o que vira "Total" na legenda/tabela); todas as séries
  compartilham o mesmo eixo de meses, sem célula perdida. Descoberta
  no processo: `calcularTendenciaMensal` usa um eixo dinâmico (só
  meses com alguma despesa, de qualquer categoria) — não um calendário
  fixo de 12 posições; o teste foi ajustado pra esse comportamento
  real em vez de presumir 12 sempre (não era um bug, só uma suposição
  errada minha ao escrever o teste). `npx tsc --noEmit` e
  `npm run lint` limpos; `curl` em `/ofensores` (categoria e credor)
  confirmando 200 e, inspecionando o HTML renderizado com dados reais,
  as barras, a legenda com totais e a tabela mês a mês todas presentes
  e com valores corretos.

## Transferências entre contas + ativo financiado por dívida — ✅ feito

O Felipe levantou duas lacunas reais: (1) uma transferência entre
contas próprias (TED/DOC/PIX pra pagar dívida, ou aporte em
investimento) hoje vira uma `DESPESA` solta de um lado e uma `ENTRADA`
solta do outro — nenhuma das duas é gasto ou receita de verdade, mas
as duas contavam normalmente nos relatórios de ofensor; (2) quando um
empréstimo cai direto numa conta de investimento, o ativo sobe sem
nada distinguindo "isso é patrimônio novo" de "isso é dinheiro
emprestado guardado em outro lugar". Investiguei `AtivoPassivoVinculo`
achando que pudesse já resolver o ponto 2 (o nome sugeria isso) e
confirmei que era só uma etiqueta de garantia/colateral, texto livre,
nunca lida por nenhum cálculo — a fórmula de patrimônio líquido já
fecha certo quando as duas pontas (ativo e dívida) são registradas; o
risco real é esquecer de registrar o lado da dívida.

- **Transferência**: `Transacao` ganhou `ehTransferencia Boolean
  @default(false)` (migração `transferencia_e_vinculo_ativo_passivo`).
  As três funções que já filtravam `tipo: "DESPESA"` em
  `src/lib/ofensores.ts` (`calcularMaioresOfensores`,
  `calcularOfensoresPorCredor`, `calcularTendenciaMensal`) passaram a
  filtrar também `ehTransferencia: false` — uma transferência nunca
  conta como ofensor, esteja como `DESPESA` (saindo) ou `ENTRADA`
  (chegando). Novo checkbox "Transferência entre minhas contas" em
  `TransacaoSheet.tsx` (grava via `atualizarTransacao`), nova ação
  `marcarTransferenciaEmLote` (mesmo padrão de
  `atualizarCategoriaEmLote`/`atualizarVinculoEmLote`) com botões na
  toolbar de seleção múltipla de `TransacoesTable.tsx`, rótulo neutro
  "transferência" (cor neutra, nem despesa nem receita) na linha e no
  Sheet, e novo filtro `transferencia=1` em `/transacoes` (simétrico a
  `semCategoria`/`semVinculo`). Vincular a transferência a um
  passivo/ativo continua usando os campos que já existem
  (`passivoId`/`ativoId`) — sem campo novo pra isso.
- **Ativo financiado por dívida**: `AtivoPassivoVinculo.tipoVinculo`
  virou um enum de verdade (`TipoVinculoAtivoPassivo`: `GARANTIA` |
  `FINANCIAMENTO`) em vez de texto livre — migração normalizou o único
  registro real existente (`"garantia"` → `GARANTIA`, feito via SQL
  direto antes da migração pra não quebrar a constraint nova).
  `src/app/ativos/[id]/page.tsx`: o campo de texto livre virou um
  `<select>`; um vínculo `FINANCIAMENTO` ganha estilo de dívida
  (vermelho) e o aviso "o saldo desse ativo veio do dinheiro dessa
  dívida — ainda não é patrimônio líquido novo", refletido também na
  listagem de `/ativos`. Nova checagem em `calcularQualidadeDados`
  (`src/lib/qualidadeDados.ts`): sinaliza ativo `FINANCIAMENTO`
  vinculado a um passivo já `QUITADO` (vínculo esquecido) ou com saldo
  desatualizado (reaproveita o mesmo sinal já usado pra
  `passivosDesatualizados`), nova seção em `/relatorio`.
- Testado isolado (`scratch-test-transferencia.ts` e
  `scratch-test-ativo-financiado.ts`, dados descartáveis, limpos ao
  final e conferidos por contagem antes/depois — 15 passivos, 1
  ativo, 1 vínculo `GARANTIA` intactos): transação marcada
  `ehTransferencia` (despesa ou entrada) some das três funções de
  ofensor, mesmo com valor gigantesco de propósito pra garantir que
  vazamento seria óbvio; ativo `FINANCIAMENTO` com passivo quitado ou
  nunca atualizado é sinalizado, com o motivo certo; vínculo
  `GARANTIA` não é sinalizado por engano. `npx tsc --noEmit` e
  `npm run lint` limpos (achei e corrigi de passagem uma referência
  antiga `"garantia"` minúscula em `prisma/seed.ts` que o TS acusou
  depois da mudança pra enum). Bug de ambiente pego de novo (mesmo
  padrão de sessões anteriores): o servidor de dev já estava rodando
  quando rodei a migração e ficou com o Prisma Client antigo em
  memória — `/transacoes`, `/relatorio` e `/ofensores` responderam 500
  ("Unknown argument `ehTransferencia`") até reiniciar do zero; depois
  do restart, todas as rotas voltaram a 200 e o HTML confirmou o
  filtro "Transferências" e o vínculo real "garantia de 6 consignados
  Itaú" renderizando certo.

## Auditoria: transferência ignorada em todo lugar que devia — ✅ feito

O Felipe perguntou, com razão, se a marcação de transferência
impactava só os relatórios de ofensor ou o sistema todo — e se algum
número podia ter ficado errado por causa disso. Varri todo o `src/`
procurando cada lugar que soma `Transacao` real. Resultado, registrado
pra referência futura:

- **Confirmadamente não usam `Transacao` (não podem ser afetados por
  isso)**: Consultor (`src/lib/consultor.ts` — usa
  `Conta.saldoAtualCentavos`, `Passivo`, `RecorrenciaFinanceira`), Mapa
  / rota de saída (`estadoAtual.ts`, `otimizacao.ts`), Fluxo do mês /
  margem livre (`margemLivre.ts`), Patrimônio líquido (`metrics.ts`),
  Resumo, resumo pra IA e score de saúde.
- **Usam `Transacao` mas de propósito não devem excluir transferência**:
  `calcularReconciliacaoPassivo` — uma transferência marcada pra pagar
  uma dívida ainda é um pagamento de verdade, tem que continuar
  reduzindo o saldo sugerido do passivo. Confirmado que está certo do
  jeito que está.
- **Já herdavam a correção anterior**: "O que mudou" e o ranking do
  mês em `/relatorio` (chamam `calcularOfensoresPorCredor`/
  `calcularTendenciaMensal`, já corrigidas).
- **Gaps reais encontrados e corrigidos agora** — 4 lugares que ainda
  contavam transferência como gasto real, todos com o mesmo
  `ehTransferencia: false` adicionado ao `where`:
  1. `src/app/cartoes/page.tsx` — "gasto do mês atual" de cada cartão
     (aggregate direto na página, não passava pelas funções já
     corrigidas).
  2. `calcularHistoricoComTendenciaCartao`
     (`src/lib/ofensores.ts`) — histórico + tendência de 6 meses de
     cada cartão em `/cartões`.
  3. `usoPorCategoria` em `src/app/ofensores/page.tsx` — "Orçamento
     por categoria", comparação do gasto do mês com o limite definido.
  4. `calcularParcelasAbertas` (`src/lib/parcelasFuturas.ts`) — risco
     baixo na prática, mas por consistência.
- Testado isolado (`scratch-test-transferencia-gaps.ts`, dados
  descartáveis, limpos ao final e conferidos por contagem antes/depois
  — 15 passivos e 1433 transações intactos): transação marcada
  `ehTransferencia: true` vinculada a um cartão de teste não aparece
  no "gasto do mês atual", nem nos meses reais do histórico do cartão
  (cuidado tomado no teste pra não somar os meses projetados junto —
  esses são estimativa, não fazem parte desta checagem), nem no
  "usado" do orçamento por categoria; uma parcela marcada (por engano)
  como transferência não aparece em "próximas parcelas". `npx tsc
  --noEmit` e `npm run lint` limpos; `/cartoes`, `/ofensores` e
  `/transacoes` respondendo 200 (sem precisar reiniciar o servidor
  dessa vez — nenhuma migração nova, só código de aplicação).

## Por que o Agiota some no Comparativo mensal — diagnóstico e correção — ✅ feito

O Felipe reparou que o Agiota não aparecia no "Comparativo mensal" e
ficou preocupado se outras dívidas também estariam sumindo. Rodei as
funções reais (`calcularOfensoresPorCredor`, `calcularTendenciaMensal`)
contra o banco pra não responder no chute:

- **Não é bug**: na visão padrão ("ver por: Categoria"), o Agiota é
  uma subcategoria de "Empréstimo" — `calcularTendenciaMensal` agrupa
  por categoria **raiz**, então Agiota + Leka 1 + Leka 2 + consignados
  etc. somam juntos numa única barra "Empréstimo". Na visão "Credor" o
  Agiota já aparecia certinho, na 3ª posição (R$112.500 nos últimos 12
  meses) — confirmado rodando a função de verdade, não só lendo
  código.
- **Achado real e mais sério**: 8 dos 15 passivos ativos (incluindo "6
  consignados Itaú", com custo mensal de R$13.499/mês) têm **zero**
  transação vinculada nos últimos 12 meses — esses nunca aparecem em
  nenhuma visão, categoria ou credor, porque não é questão de
  agrupamento: não há dado nenhum linkado. E "Sem vínculo a um credor"
  é R$1.238.297,74 nos últimos 12 meses — de longe o maior valor de
  todos, sugerindo fortemente que pagamentos reais desses 8 passivos
  estão escondidos ali dentro em vez de vinculados ao credor certo.

Correção:

- `src/app/ofensores/page.tsx`: nota explicativa ao lado do toggle "ver
  por" — na visão Categoria, explica que dívidas da mesma categoria
  raiz somam juntas e que "Credor" mostra cada uma separada.
- `src/app/ofensores/GraficoComparativoMensal.tsx`: séries
  `sem-vinculo`/`sem-categoria` ganharam cor de alerta (`--gold`, não
  mais uma cor categórica ou o cinza neutro de "Outros") e um link
  "resolver" direto na legenda pra `/transacoes?semVinculo=1` ou
  `?semCategoria=1` — o maior valor do gráfico agora vem com o "resolver
  isso" ao lado.
- Nova checagem em `calcularQualidadeDados` (`src/lib/qualidadeDados.ts`):
  `passivosSemMovimentoRecente` — passivo ativo sem nenhuma `DESPESA`
  não-transferência vinculada nos últimos 12 meses (mesma janela do
  Comparativo mensal). Nova seção em `/relatorio` listando cada um,
  com o custo mensal esperado e link direto pro passivo e pra
  `/transacoes?semVinculo=1`.
- Testado isolado (`scratch-test-sem-movimento.ts`, dados descartáveis,
  limpos ao final — 15 passivos e 1433 transações intactos): passivo
  sem nenhuma despesa real recente aparece na lista (inclusive quando a
  única transação vinculada é uma transferência, corretamente
  ignorada); passivo com só uma transação de 13 meses atrás (fora da
  janela) também aparece; passivo com pagamento real recente não
  aparece. `npx tsc --noEmit` e `npm run lint` limpos; `/ofensores`
  (categoria e credor) e `/relatorio` respondendo 200, com a nota
  explicativa, o destaque dourado de "Sem vínculo" com o link
  "resolver", e a nova seção de passivos sem movimento — todos
  confirmados no HTML renderizado com dados reais (inclusive "Leka 2"
  e "6 consignados Itaú" aparecendo na lista de sem-movimento, batendo
  com o diagnóstico).

## Reconciliação não respeitava dívida "só juro" + aporte pontual em Comparar estratégias — ✅ feito

O Felipe reparou que o Sem Parar/Afinz aparecia com saldo desatualizado
(R$5.229,30, mas a fatura real já está em ~R$670) e perguntou se isso
podia estar distorcendo a comparação de estratégias. Sem Parar/Afinz é
`tipo: cartao` (conta revolvente, como pedágio eletrônico) — pagar o
boleto documentado zera aquele ciclo, mas um novo já começa a
acumular, então o modelo de "quando quita" da Otimização não se aplica
bem a ele; ele está desmarcado na simulação hoje, então não distorce
nada agora — recomendei atualizar o saldo à mão pra refletir a fatura
atual.

Só que, ao conferir se o Agiota corria o mesmo risco, achei um bug de
verdade: **`calcularReconciliacaoPassivo`
(`src/lib/passivoReconciliacao.ts`) não olhava pra `estrutura` do
passivo** — tratava todo pagamento vinculado como redução direta do
saldo, inclusive num passivo `SO_JUROS_SEM_AMORTIZACAO` (Agiota, Leka
1, Leka 2), onde isso é o oposto do que o motor de simulação
(`src/lib/otimizacao.ts`) já faz certo: nesse tipo de dívida o
pagamento mensal é só juro, o saldo só zera com quitação total de uma
vez. Testei contra o Agiota real: hoje ele não mostra sugestão nenhuma
(nem a errada, nem a nova) porque o banco foi re-semeado recentemente
e o `createdAt` do passivo ficou mais novo que os 5 pagamentos
históricos (fora da janela "desde a última atualização") — mas simulei
um pagamento parcial recente de verdade vinculado ao Agiota real e
confirmei que, sem a correção, isso teria sugerido reduzir o saldo de
R$172.500 pra R$60.000 (creditando R$112.500 de puro juro como se
fosse principal) — e com a correção, não sugere nada, do jeito certo.

- `src/lib/passivoReconciliacao.ts`: `calcularReconciliacaoPassivo`
  ganhou `pagamentoEhSoJuroSemAbaterPrincipal` — quando
  `estrutura === SO_JUROS_SEM_AMORTIZACAO` e o total pago não atingiu o
  saldo documentado, não sugere redução nenhuma (só quitação total, de
  uma vez, zera). `AMORTIZA_NORMAL`/`SEM_JUROS` continuam exatamente
  como estavam.
- `src/app/passivos/[id]/page.tsx`: nova explicação quando esse for o
  caso — "esses R$X pagos foram juro, não abatem o principal — só uma
  quitação total reduz esse saldo" — em vez de ficar em silêncio ou
  sugerir algo errado.
- **Aporte pontual em Comparar estratégias**: `simularOrdem`,
  `simularOrdemComSplit` e `encontrarOrdemMenosJuros`
  (`src/lib/otimizacao.ts`) ganharam `aportePontualCentavos` opcional —
  entra só na distribuição do primeiro mês simulado, nunca no aporte
  recorrente permanente (senão um valor avulso viraria recorrente por
  engano). Novo campo "Aporte pontual (uma vez, R$)" em
  `OtimizacaoForm.tsx`, ao lado do aporte mensal, alimentando as 4
  estratégias já existentes lado a lado — mesmo padrão do 13º/restituição
  já usado no Consultor (`AlocacaoEntradaPontual`), só que agora
  respondendo "como isso muda as 4 estratégias", não "pra onde esse
  dinheiro deveria ir".
- Testado isolado: `calcularReconciliacaoPassivo` com 3 casos
  sintéticos (juro-puro parcial não sugere nada; juro-puro com
  quitação total sugere R$0; amortização normal continua reduzindo por
  pagamento parcial) — pegou de novo o clássico problema de timing
  (transação datada antes do `createdAt` do passivo de teste, corrigido
  usando uma data 1 min à frente); mais uma verificação direta contra
  o Agiota real com um pagamento sintético recente, confirmando o
  comportamento certo no dado de produção. `simularOrdem`/
  `simularOrdemComSplit` testados confirmando que o aporte pontual é
  aplicado só no mês 1 e não vaza pro aporte recorrente dos meses
  seguintes. `npx tsc --noEmit` e `npm run lint` limpos; `/otimizacao`,
  e as páginas reais do Agiota e do Sem Parar/Afinz respondendo 200,
  com o campo "Aporte pontual" confirmado no HTML renderizado.

## Separação dos "6 consignados Itaú" em 6 passivos reais individuais

Migração de **dados reais de produção**, não só código — Felipe apontou
que agrupar 6 empréstimos consignados independentes num único Passivo
("6 consignados Itaú (garantia CDB)") escondia que cada um pode ser
quitado isoladamente, com sua própria taxa/parcela/saldo, distorcendo
qualquer simulação de ordem de ataque na Otimização.

- Ele mandou os 6 "Documento Descritivo de Crédito" reais do Itaú (um
  PDF por contrato, com número do contrato, saldo devedor, valor
  financiado, taxa de juros, parcelas pagas/em aberto e o cronograma
  completo de 72 parcelas). Conferência antes de usar qualquer número:
  a soma das 6 parcelas mensais reais bateu **exatamente** com o valor
  já cadastrado no passivo combinado (R$13.499,63) — forte confirmação
  de que eram exatamente esses 6 contratos.
- `prisma/schema.prisma`: `AtivoPassivoVinculo` ganhou
  `valorGarantidoCentavos Int?` — fatia do valor de um Ativo penhorada
  pra um Passivo específico via vínculo `GARANTIA` (migração
  `vinculo_valor_garantido`).
- `scratch-migrar-consignados.ts` (script real, não descartável, uma
  transação Prisma): criou 6 `Documento` (`tipo: "contrato"`, PDFs reais
  copiados pra `storage/documentos/`), 6 `Passivo` novos ("Consignado
  Itaú <contrato>") com os dados reais de cada PDF, 6
  `AtivoPassivoVinculo` (`GARANTIA` com o CDB "Privilege"), reapontou 4
  transações "INT RESGATE PRIVILEGE" que estavam presas por engano ao
  passivo combinado (são movimentação do próprio CDB, não desembolso de
  empréstimo — reapontadas pro `ativoId`), e marcou o passivo combinado
  antigo como `QUITADO` com observação explicando a substituição (não
  apagado — mantém rastro histórico; passivos `QUITADO` já são
  excluídos dos agregados de dívida ativa).
- **Bug pego durante o teste, corrigido antes de reportar como pronto**:
  o primeiro `valorGarantidoCentavos` usado foi o "saldo devedor" de
  cada PDF — só que esse número do Itaú já embute ~6 anos de juros
  futuros do sistema Price, não é o principal realmente penhorado.
  Resultado: a tela do CDB mostrou "livre" **negativo**
  (-R$25.008,27), um absurdo. Corrigido trocando pra "valor financiado"
  (o principal real emprestado, também documentado em cada PDF) via
  `scratch-corrigir-valor-garantido.ts` — resultado final: preso
  R$420.265,56, livre R$20.231,49 (bate com o valor real do CDB,
  R$440.497,05). Importante: nenhum dos 6 PDFs documenta um "valor de
  garantia" explícito — "valor financiado" é a aproximação mais
  defensável disponível, editável manualmente por vínculo se o banco
  informar outro número.
- `src/app/ativos/[id]/page.tsx`: nova seção mostrando "Preso em
  garantia (dívidas ativas)" vs. "Livre" quando o ativo tem vínculos
  `GARANTIA` com `valorGarantidoCentavos` — calculado na leitura,
  nunca altera o `valorCentavos` documentado do ativo (sem inventar
  depósito que não existe no extrato real). Vínculo quitado passa a
  mostrar "liberada (quitado)"; lista de vínculos mostra o valor
  garantido por linha.
- `src/app/ativos/actions.ts` (`vincularAtivoPassivo`): novo campo
  opcional `valorGarantidoCentavos`, só persistido quando `tipoVinculo`
  é `GARANTIA`.
- Confirmado por exploração de código antes de migrar: nenhum arquivo
  referenciava o id do passivo combinado nem filtrava por
  `tipo === "consignado"` — Otimização, Consultor, Mapa de Saída,
  Relatório e dashboard tratam passivos genericamente, então 6
  registros no lugar de 1 não quebrou nada. O alerta de "passivo
  recente sem meta" só dispara pra 1-3 passivos sem meta de uma vez —
  6 de uma tacada ficou corretamente acima do limite (tratado como
  carga em lote, sem alerta falso).
- Testado isolado (`scratch-test-garantia-liberada.ts`, esse sim
  descartável, com Ativo/Passivos sintéticos e limpeza confirmada no
  final — sem tocar em nenhum dos 6 passivos reais): "livre" sobe
  exatamente pelo valor garantido de cada passivo quando ele é marcado
  `QUITADO`.
- Verificado no dado real via `sqlite3` (6 passivos com valores exatos
  dos PDFs, antigo `QUITADO`, 4 transações realocadas, 6 vínculos
  novos) e no servidor de dev: `/passivos` (6 linhas novas + antigo
  quitado), `/ativos/[id]` do CDB (preso/livre corretos),
  `/otimizacao` (6 consignados entrando na simulação, confirmado no
  HTML), `/ofensores?ver=credor` — os 6 não aparecem aí porque esse
  débito automático nunca teve transação de despesa importada nos
  últimos 12 meses (mesmo gap já registrado antes da migração, não uma
  regressão nova). `npx tsc --noEmit` e `npm run lint` limpos.

## Alerta global de pagamento pendente + cronograma real de parcelas + quitar/amortizar

Felipe apontou que o Sem Parar/Afinz, já pago de verdade (transação real
vinculada, confirmada em segmento anterior), continuava aparecendo como
não pago em `/otimizacao`. Investigação confirmou que isso é sistêmico,
não só do Sem Parar: `/otimizacao`, o simulador à vista do `/consultor`
e o "você deve X hoje" do Mapa leem `Passivo.valorQuitacaoCentavos`
direto do banco — nunca chamam `calcularReconciliacaoPassivo`, que só
roda na tela individual `/passivos/[id]`. O alerta de "desatualizado"
que já existia em `/relatorio` é baseado em tempo (nunca confirmado ou
≥60 dias), não em fato real pendente — não pega de forma confiável o
caso "paguei e o extrato já mostra, mas ninguém confirmou".
Confirmado também: o Score de Saúde Financeira **não** usa
`valorQuitacaoCentavos` (vem de reserva/margem/cheque especial/fatura),
então não é afetado por esse bug — só Otimização, Consultor à vista e
patrimônio líquido do Mapa são.

- `src/lib/qualidadeDados.ts`: novo `passivosComReconciliacaoPendente`,
  rodando `calcularReconciliacaoPassivo` pra todos os passivos `ATIVO`
  e coletando os que têm `saldoSugeridoCentavos != null` — pagamento
  real vinculado, nunca confirmado.
- Banner reaproveitando esse check em `/otimizacao`, `/consultor`,
  `/(mapa)` (perto do "você deve X hoje") e nova seção em cima da
  antiga em `/relatorio` (renomeada "Passivos desatualizados há muito
  tempo" pra diferenciar da nova "Pagamento real pendente de
  confirmação"); indicador "pagamento pendente" por linha em
  `/passivos`.
- Confirmado no dado real: Sem Parar/Afinz aparece corretamente na
  nova seção com "sugerido R$0,00" (o pagamento de R$5.229,30 bate
  exatamente com o saldo documentado).

Segunda parte: Felipe pediu um botão de quitar/amortizar vinculado a
uma transação real do extrato, e perguntou se fazia sentido o sistema
estimar sozinho o avanço das parcelas usando o contrato, mesmo sem
confirmação. Tentei validar isso com a fórmula padrão de amortização
Price e **não bateu** com os 6 contratos reais dos consignados — os
primeiros 15-20 meses de cada um têm Principal R$0,00 (carência), que
a fórmula genérica não replica. Felipe decidiu (opção recomendada):
guardar as 72 parcelas reais de cada PDF em vez de usar fórmula.

- `prisma/schema.prisma`: novo model `PassivoParcelaCronograma`
  (numeroParcela, vencimento, principal/juros/valorParcela/saldoDevedor
  em centavos, documentoId) — uma linha por parcela real documentada.
  `PassivoHistorico` ganhou `confiabilidade Confiabilidade?` (reaproveita
  o enum já usado em `RecorrenciaFinanceira`) pra distinguir uma
  confirmação real (`null`) de uma estimativa aceita (`ESTIMADO`).
- **Achado importante durante a implementação**: a coluna "Saldo
  devedor atual" de cada linha do PDF não é o saldo total do
  empréstimo — a parcela 1 (já paga) mostra R$0,00, não batendo com o
  header. Perguntei ao Felipe como tratar isso; decisão (recomendada):
  usar só o Principal de cada parcela pra abater do saldo **já
  documentado** do passivo, nunca a coluna "saldo devedor atual" (que
  fica gravada só como referência, sem alimentar nenhum cálculo).
- `scratch-migrar-cronograma-consignados.ts` (real, não descartável):
  gravou as 432 linhas (72 × 6 contratos) com os dados exatos dos
  PDFs. Conferência antes de gravar: soma do Principal de cada
  contrato bate exatamente (diff R$0,00) com o "Valor financiado"
  documentado nos 6 casos.
- **Bug pego e corrigido durante a verificação manual**: as datas de
  vencimento foram gravadas como meia-noite UTC; renderizadas no fuso
  do servidor (America/Sao_Paulo, UTC-3), apareciam um dia a menos
  (ex: parcela com vencimento real 30/09 mostrava "29/09"). Corrigido
  com um ajuste de +3h em todas as 432 linhas via SQL direto, e a
  função `dataBR` do script de migração corrigida pra usar meia-noite
  local em vez de UTC. Confirmado no servidor: a mesma parcela passou a
  mostrar "30/09/2026" corretamente.
- `src/lib/cronogramaAmortizacao.ts` (novo): `proximaParcela` e
  `calcularEstimativaCronograma` — puramente derivado, nunca aplicado
  sozinho.
- `src/app/passivos/actions.ts`: `confirmarPagamentoPassivo` (exige
  selecionar uma transação de saída já existente e sem vínculo — nunca
  cria transação nova; se o valor cobre o saldo inteiro é quitação
  total, senão abate o Principal documentado da próxima parcela do
  cronograma quando existir, senão mantém o comportamento simples de
  sempre) e `aceitarEstimativaCronograma` (só quando há parcela
  vencida e não confirmada; grava com `confiabilidade: ESTIMADO`).
- `src/app/passivos/[id]/page.tsx`: nova seção "Quitar / Amortizar"
  (mostra o preview real da próxima parcela antes de escolher a
  transação) e bloco de estimativa por cronograma quando aplicável —
  nenhum dos dois alimenta Otimização/Consultor automaticamente, sempre
  exige clique explícito.
- Testado isolado (`scratch-test-cronograma-amortizacao.ts`,
  descartável, Passivo/cronograma/transações 100% sintéticos, limpeza
  confirmada): `calcularEstimativaCronograma` soma o Principal certo
  das parcelas vencidas; `aceitarEstimativaCronograma` grava saldo e
  `parcelaAtual` corretos com `confiabilidade: ESTIMADO`;
  `confirmarPagamentoPassivo` com amortização parcial abate só o
  Principal da parcela certa (não o valor pago inteiro); com valor
  cobrindo o saldo inteiro, quita e marca `QUITADO`. Pego durante o
  teste: as Server Actions chamam `revalidatePath`, que lança
  "Invariant: static generation store missing" fora de uma requisição
  Next real — a escrita no banco já tinha sido concluída antes disso;
  o teste passou a tolerar só esse erro específico (qualquer outro
  continua propagando), e um resíduo de teste deixado pela primeira
  tentativa (antes desse ajuste) foi limpo manualmente e confirmado
  via `sqlite3`.
- `npx tsc --noEmit` e `npm run lint` limpos. Servidor de dev: `curl`
  em `/otimizacao`, `/consultor`, `/`, `/relatorio`, `/passivos` (todos
  os banners com conteúdo real, não só 200) e `/passivos/[id]` de um
  dos 6 consignados (preview da próxima parcela e dropdown de
  transações candidatas confirmados no HTML renderizado).

## Correção: transação já vinculada não aparecia no "Quitar / Amortizar"

Felipe reportou, com capturas de tela reais: o pagamento do Sem
Parar/Afinz (visível em `/transações`, com vínculo já feito) não
aparecia pra escolher no botão "Quitar / Amortizar" novo. Causa raiz
confirmada no dado real: a query de transações candidatas em
`src/app/passivos/[id]/page.tsx` buscava só `passivoId: null`
(transação **ainda sem vínculo nenhum**) — mas o pagamento do Sem
Parar (e também o do Magazine Luiza/Luizacred, o outro passivo que o
alerta global do segmento anterior já lista como pendente) **já
estava vinculado** de antes, feito manualmente em `/transações` antes
de esse botão existir. Dois mecanismos que deveriam se completar
(a caixa antiga "Atualizar saldo", que só entende transação já
vinculada, e o botão novo, que só entendia transação sem vínculo)
ficaram cada um cego pro caso do outro.

- Corrigido: a query passou a incluir `OR: [{ passivoId: null },
  { passivoId: id }]` — agora traz tanto transação nova quanto uma já
  vinculada a este mesmo passivo esperando confirmação.
  `confirmarPagamentoPassivo` não precisou mudar — vincular de novo a
  mesma transação ao mesmo passivo já era inofensivo (no-op).
- Conferido nos dados reais: só existem hoje 2 passivos nessa situação
  (Sem Parar/Afinz e Magazine Luiza/Luizacred — os mesmos 2 que o
  banner global já lista), ambos `SEM_JUROS`, sem risco do problema de
  "juro sendo tratado como principal" que motivou o cuidado extra nos
  6 consignados.
- Sobre a Otimização "não mostrar" o Sem Parar: conferido que a
  captura de tela mais recente do Felipe já mostra o passivo com
  checkbox marcado e o banner de alerta corretos — a captura antiga
  que parecia mostrar o contrário era de uma aba com a versão anterior
  da página, de antes das mudanças do segmento anterior.
- Registrado como cuidado futuro (não um bug ativo hoje): nenhum dos 6
  consignados tem transação vinculada ainda, mas se um dia uma for
  vinculada por fora do fluxo novo (direto em `/transações`), a caixa
  antiga de reconciliação sugeriria abater o valor pago inteiro do
  saldo sem separar o juro (ela não é ciente do cronograma) — revisitar
  se/quando isso acontecer.
- Testado isolado (`scratch-test-transacao-ja-vinculada.ts`,
  descartável, passivo/transação sintéticos, limpeza confirmada):
  reproduz o bug original (query antiga não encontrava a transação já
  vinculada), confirma que a query nova encontra, e que
  `confirmarPagamentoPassivo` processa a quitação total corretamente.
- Confirmado no servidor real: `/passivos/cmtu83ytk001otht7niqo2g5e`
  (Sem Parar de verdade) agora mostra "PAG BOLETO SEM PARAR — R$
  5.229,30" como opção selecionável no dropdown de "Quitar/Amortizar".
  `npx tsc --noEmit` e `npm run lint` limpos.

## Correção de dado real: parcela do Financiamento Esmeraldina/Caixa (2 → 28) + auditoria de mudança de parcela

Felipe apontou que o Financiamento Esmeraldina/Caixa estava cadastrado
com `parcelaAtual: 2` de `totalParcelas: 240`, mas o contrato real já
está na parcela 28 — e perguntou se isso mudava número em `/resumo` e
outras telas periféricas. Investigado arquivo por arquivo antes de
qualquer mudança: a resposta honesta é **não, na prática** —
`Passivo.parcelaAtual`/`totalParcelas` hoje só alimentam o texto de
progresso ("X/240") em `/passivos` e `/passivos/[id]`; nenhum cálculo
em Otimização, Consultor, Mapa, Ofensores ou Resumo lê esses dois
campos (Resumo nem cita passivo individual, só agrega por `estrutura`
e saldo). O mecanismo de cronograma real dos 6 consignados
(`PassivoParcelaCronograma`, que aí sim usaria `parcelaAtual` pra
calcular de verdade) não existe pra esse financiamento — sem PDF de
cronograma dele. Felipe decidiu corrigir mesmo assim (dado errado é
errado) e auditar a mudança.

- `scratch-corrigir-parcela-esmeraldina.ts` (real, não descartável):
  atualizou `parcelaAtual` pra 28 (mantendo `totalParcelas: 240`) e
  criou manualmente uma linha em `PassivoHistorico` explicando a
  correção — necessário porque a action de edição não rastreava esse
  campo (ver próximo item).
- `src/app/passivos/actions.ts` (`atualizarPassivo`): a checagem de
  diff que só cobria `valorQuitacaoCentavos`/`custoMensalCentavos`
  ganhou `parcelaAtual`/`totalParcelas` — daqui pra frente, editar a
  parcela de qualquer passivo direto em `/passivos/[id]/editar` fica
  registrado sozinho em `PassivoHistorico`, sem precisar de script.
- Achado à parte durante a investigação, deixado de fora por decisão
  do Felipe (quer conferir o contrato antes): a taxa de 19,2% desse
  mesmo financiamento é comparada em `/consultor`
  (`src/lib/renegociacao.ts`) contra uma faixa de mercado **mensal**
  (1%–1,8% a.m.), disparando um alerta de "taxa acima do mercado" —
  mas 19,2% faz muito mais sentido como taxa **anual** de financiamento
  imobiliário (~1,47% a.m., dentro da faixa normal). Parece um alarme
  falso já ativo no sistema; registrado aqui pra retomar quando o
  Felipe confirmar com o contrato.
- Testado isolado (`scratch-test-historico-parcela.ts`, descartável,
  passivo sintético, limpeza confirmada): editar `parcelaAtual` via
  `atualizarPassivo` agora gera exatamente 1 linha de histórico (campo
  certo, valores antes/depois certos), e campos que não mudaram
  (`valorQuitacaoCentavos`/`custoMensalCentavos` mantidos iguais) não
  geram falso positivo.
- Confirmado no servidor real: `/passivos/cmtu83ytd001itht7rgf3yjlh`
  mostra "28/240" e a linha "Correção: contrato real já estava na
  parcela 28..." no histórico de mudanças. `npx tsc --noEmit` e
  `npm run lint` limpos.

## Rota de Saída: parar de mostrar vitória falsa + ordem de "menor juro" comprovadamente ótima

Felipe achou a trilha "completamente equivocada": o card "6 consignados
Itaú (garantia CDB)" aparecia como "QUITADO, R$0,00" logo no início,
antes do Agiota — parecendo uma vitória de quase meio milhão de reais
que nunca aconteceu. Investigação encontrou duas causas reais e
distintas (nenhuma dívida estava faltando na trilha — as 17 ativas
documentadas já apareciam todas, confirmado via curl no servidor real):

1. **Vitória falsa**: qualquer passivo `QUITADO` vira uma estação
   "R$0,00" na trilha (`src/app/(mapa)/page.tsx`), sem olhar o saldo
   real — certo pro Sem Parar/Afinz (pago de verdade), errado pro "6
   consignados" (só foi substituído pelos 6 passivos individuais, nunca
   pago, e continua com R$466.190,28 documentado de propósito como
   rastro histórico).
2. **Ordem sem garantia acima de 7 dívidas**: `encontrarOrdemMenosJuros`
   só testava todas as combinações até 7 dívidas; com as 17 de hoje
   caía numa heurística simples (maior custo mensal primeiro, resto por
   saldo) sem avisar que não era mais garantidamente a ordem ótima.

Correções:

- `prisma/schema.prisma`: `Passivo.substituido Boolean @default(false)`
  — true quando o passivo não foi pago de verdade, só reorganizado.
  Migração `passivo_substituido`. Script real marcou o "6 consignados
  Itaú (garantia CDB)" com `substituido: true`.
- `src/lib/estadoAtual.ts`: `passivosQuitados` (que alimenta a trilha)
  passa a filtrar `status === "QUITADO" && !substituido` — o registro
  continua 100% visível e com o saldo real em `/passivos`, só sai da
  celebração da trilha.
- `src/app/passivos/PassivoForm.tsx` + `atualizarPassivo`: novo
  checkbox "Não contar como vitória na trilha" — da próxima vez isso
  não precisa de script, e a mudança fica registrada em
  `PassivoHistorico` (mesmo padrão de diff já usado nos outros campos).
- **Melhoria de algoritmo em `src/lib/otimizacao.ts`
  (`encontrarOrdemMenosJuros`)**: lendo `simularOrdem` com cuidado,
  achei que `jurosTotalCentavos` só é alimentado pelas dívidas
  `SO_JUROS_SEM_AMORTIZACAO` — nenhuma ordem entre as demais muda esse
  número, só afeta quanto tempo leva pra quitar todas. Ou seja, colocar
  esse subgrupo inteiro primeiro já é sempre ótimo, e a ÚNICA coisa que
  ainda decide o juro total é a ordem *dentro* dele — que normalmente é
  pequeno (são as dívidas "no escuro"). Em vez de uma heurística pro
  problema inteiro (o que eu tinha planejado inicialmente: reordenar
  por taxa de juros — descartado ao perceber que taxa nem é usada nesse
  cálculo), a correção testa exaustivamente todas as combinações **só
  desse subgrupo**, mesmo com o total geral passando de 7 — dá o mínimo
  de juro de verdade, não uma aproximação, sempre que esse subgrupo
  específico couber na busca exaustiva (na prática, quase sempre cabe:
  hoje são só 3 dívidas — Agiota, Leka 1, Leka 2). Só cai numa
  aproximação (regra de Smith: maior sangria mensal por real de saldo
  primeiro) no caso raro de mais de 7 dívidas desse tipo ao mesmo
  tempo — e só nesse caso a tela avisa que não há garantia de mínimo
  absoluto (`src/app/(mapa)/page.tsx`).
- Testado isolado (`scratch-test-ordem-menos-juros.ts`, descartável):
  (1) com as 17 dívidas reais, o novo algoritmo reporta `exaustivo:
  true` e o juro total é igual ou menor que a heurística antiga (nesse
  caso, empatou — a heurística antiga já acertava por coincidência,
  mas agora tem garantia matemática, antes era só sorte); (2) caso
  sintético de 8 passivos (3 "só juros") — o resultado do algoritmo por
  subgrupo bate **exatamente** com o ótimo global encontrado por força
  bruta nas 8! combinações inteiras; (3) caso sintético de 8 dívidas
  "só juros" (acima do limite) — cai no fallback e segue a razão
  custoMensal/saldo decrescente corretamente.
- Confirmado no servidor real: `/` não mostra mais o card "6
  consignados Itaú (garantia CDB)" na trilha (Sem Parar/Afinz continua,
  correto), a nota de heurística não aparece (dado real hoje é
  comprovadamente ótimo), e `/passivos` continua mostrando o registro
  substituído com o saldo real de R$466.190,28. `npx tsc --noEmit` e
  `npm run lint` limpos.

## Corrigir vínculos reais de transações (achado ao avaliar importar o Open Finance)

Felipe perguntou se fazia sentido importar um relatório categorizado do
Open Finance/Organizze (extrato consolidado Itaú/Nubank/Mercado Pago).
Comparei linha a linha com o banco real: **toda transação desse
relatório já existe no sistema**, vinda do mesmo importador de extrato
do Itaú que ele já usa — recomendei não construir um importador novo
(zero dado novo, só risco de duplicar).

Mas pra fazer essa comparação, fui direto nos dados reais — e achei
algo mais valioso: **6 transações reais vinculadas ao passivo errado**
e **16 nunca vinculadas a nenhum**, todas confirmadas batendo
exatamente com os PDFs dos contratos (valor e quantidade de parcelas
idênticos às "parcelas pagas" documentadas):

- 6× "CREDIARIO AUTOM 01/72"-"06/72" sem vínculo + 2× "CRED INVESTIM"
  **mal-vinculadas ao Empréstimo pessoal Itaú** → religadas ao
  Consignado Itaú 2728846334 (as 8 juntas batem com as 8 datas
  "LIQUIDADA" do PDF).
- 1× "CREDIARIO AUTOM 01/72" sem vínculo + 2× "CRED INVESTIM"
  mal-vinculadas → religadas ao Consignado Itaú 2861406995 (bate com
  as 3 datas do PDF).
- 1× "CREDIARIO AUTOM 01/72" sem vínculo + 2× "CRED INVESTIM"
  mal-vinculadas → religadas ao Consignado Itaú 2869222998 (bate com
  as 3 datas do PDF).
- 8× "CREDIARIO AUTOM" (R$1.888,11) sem vínculo → vinculadas ao
  Empréstimo pessoal Itaú (esse era o passivo certo pra elas; nunca
  tinha nenhuma transação vinculada).
- 1× PIX do mês corrente (R$22.500,00) sem vínculo → vinculado ao
  Agiota.

`scratch-corrigir-vinculos-transacoes.ts` (real, não descartável):
religou as 23 transações numa única `$transaction`, com checagem antes
de cada uma (valor e descrição batendo com o esperado) e conferência
depois de que o saldo documentado dos passivos **não mudou** (só o
vínculo — nenhuma mudança de código nesta correção).

**Correção honesta**: no plano, eu previa que vincular as 8 transações
no Empréstimo pessoal Itaú faria a tela dele sugerir um novo saldo
(~R$26.433,54). Conferi depois de rodar e **isso não aconteceu** — o
`createdAt` desse passivo é 09/09/2026 (o mesmo reset de banco de dados
identificado num segmento anterior desta sessão, que afetou todos os
15 passivos originais), e a reconciliação só olha transações a partir
dessa data — as 8 vinculadas são todas de jan-ago/2026, ou seja, ficam
fora da janela e não geram sugestão nenhuma. É o mesmo problema de
fundo já visto com o Agiota antes, não um bug novo desta correção —
mas era importante não deixar minha previsão errada no plano passar
sem correção.

Verificado no servidor real: `/passivos/[id]` de cada um dos 3
consignados mostra as transações certas em "Movimentações vinculadas"
(ex: Consignado Itaú 2728846334 com as 8 parcelas, datas e valores
batendo). `npx tsc --noEmit` e `npm run lint` limpos.

## "Vale mais resgatar e quitar": comparar rendimento do investimento com o juro que ele garante

Felipe trouxe uma provocação: os 6 consignados custam 2,05%–2,66% ao
mês (27%–39% ao ano) e são garantidos pelo CDB "Privilege"
(R$440.497,05, liquidez D+0 — resgate imediato). Nenhum CDB real chega
perto disso — então cada mês que esse dinheiro fica preso "garantindo"
em vez de quitar, é dinheiro perdido de verdade. Antes de propor código
novo, apontei duas ferramentas já existentes que respondem boa parte
disso de graça: a "Taxa de referência" do Consultor (nunca preenchida,
mas já compara `taxaJurosPct` de toda dívida contra ela) e o "Aporte
pontual" da Otimização (construído num segmento anterior, simula o
efeito de um resgate). Recomendei testar as duas primeiro.

O que faltava: nada conecta "esse investimento específico garante essas
dívidas específicas" com "vale a pena resgatar" — o vínculo `GARANTIA`
já existe, mas `Ativo` não documentava rendimento nenhum.

- `prisma/schema.prisma`: `Ativo` ganhou `rendimentoMensalPct Float?`
  — opcional, nunca inferido, só preenchido quando o Felipe souber o
  número real (mesmo padrão do `taxaJurosPct` em `Passivo`). Migração
  `ativo_rendimento_mensal`.
- `src/app/ativos/AtivoForm.tsx` + `actions.ts`: novo campo
  "Rendimento mensal (% a.m.)".
- `src/lib/arbitragemGarantia.ts` (novo, função pura): para cada
  vínculo `GARANTIA` com `valorGarantidoCentavos` e passivo `ATIVO` com
  `taxaJurosPct` documentados, quando o ativo também tem
  `rendimentoMensalPct` documentado e a dívida custa mais que o
  investimento rende, calcula
  `custoMensalCentavos = valorGarantidoCentavos × (taxaJurosPct − rendimentoMensalPct) / 100`
  — quanto custa, por mês, manter aquele pedaço preso em vez de usá-lo
  pra quitar aquela dívida específica. Exclui vínculo `FINANCIAMENTO`,
  passivo já quitado e qualquer lado sem taxa/rendimento documentado.
- `src/app/ativos/[id]/page.tsx`: ao lado do bloco "Preso em garantia /
  Livre" já existente, nova seção "Isso está te custando R$X/mês"
  quando aplicável, com a lista de passivos ordenada do que mais sangra
  pro que menos.
- `src/app/consultor/page.tsx`: nova seção "Vale mais resgatar
  investimento e quitar", mesmo estilo da seção de renegociação já
  existente, só aparece quando há alguma oportunidade real.
- Testado isolado (`scratch-test-arbitragem-garantia.ts`, descartável,
  função pura sem banco): confirma que ativo sem rendimento documentado
  nunca gera oportunidade; que rendimento maior que a taxa da dívida
  não gera oportunidade; e um caso com números do mundo real (CDB +
  consignados, ids sintéticos) confirmando que `FINANCIAMENTO`, passivo
  quitado e passivo sem taxa são corretamente excluídos, a matemática
  bate com o cálculo manual, e a ordenação é da maior sangria pra
  menor.
- Testado de ponta a ponta (`scratch-test-arbitragem-ui.ts`,
  descartável, contra o servidor de dev real): Ativo+Passivo+Vínculo
  sintéticos confirmando que a seção aparece renderizada de verdade em
  `/ativos/[id]` e `/consultor` — limpeza confirmada via `sqlite3`
  depois.
- **Não preenchi o `rendimentoMensalPct` do CDB real** — depende de um
  número que só o Felipe pode confirmar (nunca inventado); confirmado
  que as páginas reais continuam funcionando normalmente (200, sem a
  seção nova) enquanto esse campo não for preenchido.
- `npx tsc --noEmit` e `npm run lint` limpos.

## VPS como fonte única de dados reais + Resumo pra IA cobrindo o sistema todo

Duas questões levantadas ao rodar o projeto localmente pra revisão.

**Local e VPS mostravam dados diferentes.** Investigado e confirmado:
não é o mesmo banco. `DATABASE_URL="file:./dev.db"` (`.env`) resolve pra
um arquivo físico — Mac e VPS têm cada um o seu, e nunca houve
sincronização entre eles (o deploy via GitHub Actions só roda
`prisma migrate deploy`, migração de schema, nunca de dados; a única vez
que dado passou de um lado pro outro foi a cópia manual única no dia da
migração original, com `md5sum`). Desde então os dois bancos vivem e
divergem sozinhos, sem aviso nenhum. Decisão com o Felipe: **a VPS passa
a ser a fonte única de dados reais**; local vira só ambiente de teste de
código. Não rodei `npm run db:seed` no banco local pra "limpar pra
dado de mentira" como o plano original cogitava — ao checar
`prisma/seed.ts`, descobri que ele não é dado sintético: é o snapshot
real da auditoria financeira de 09/09/2026 (comentário no próprio
arquivo). Rodar `db:seed` apagaria as 1449 transações reais que ainda
estão no banco local de teste sem que isso fosse necessário pro pedido —
fica como decisão explícita do Felipe, não uma ação automática.

- `scripts/pull-vps-db.sh` (novo): puxa uma cópia **somente leitura**
  de `prisma/dev.db` da VPS via `scp -P 22022`, sempre pra um arquivo
  separado (`prisma/dev.db.vps-snapshot-<data>`, já coberto pelo
  `*.db` do `.gitignore`) — nunca sobrescreve o banco de teste local.
  Verifica integridade com `md5sum` remoto vs. local antes de dar como
  concluído, apagando a cópia se não bater (mesmo padrão já usado nas
  migrações de deploy).
- `DEPLOY_VPS.md`: nova seção "Local e VPS não são o mesmo banco"
  explicando a arquitetura e apontando pro script de pull.
- `~/.claude/skills/deploy-vps-hostgator/SKILL.md` (fora do repo, skill
  de usuário): pegadinha #8 nova — mesmo alerta, generalizado pra
  qualquer projeto SQLite nessa VPS, incluindo o cuidado de checar o
  que o `seed.ts` de cada projeto realmente contém antes de sugerir
  "resetar o banco local" como se fosse sempre seguro.

**O resumo pra IA (`/resumo/ia`) não refletia o sistema todo.** Ele
usava `gerarResumoMarkdown()` alimentado só por `carregarEstadoAtual()`,
que nunca consulta `Transacao` — nenhuma entrada, despesa real ou
pendência de conciliação chegava no texto (a "margem livre" impressa
vinha só de `RecorrenciaFinanceira`, configuração manual, não do
extrato). `calcularQualidadeDados()` (já usado em `/consultor`) também
nunca era importado ali.

- `src/lib/ofensores.ts`: nova função pura `calcularMovimentacaoDoMes(desde)`
  — soma `ENTRADA` do período e `DESPESA` por categoria raiz num único
  `findMany`, reaproveitando o mesmo agrupamento de
  `calcularMaioresOfensores`/`calcularOfensoresPorCredor` (que hoje só
  filtram `DESPESA`).
- `src/app/resumo/ia/page.tsx`: busca em paralelo (mesmo padrão do
  `/consultor`) `carregarEstadoAtual()`, `calcularQualidadeDados()` e
  `calcularMovimentacaoDoMes(inicioDoPeriodo("mes"))`.
- `src/lib/resumoIA.ts`: `gerarResumoMarkdown()` ganhou dois parâmetros
  novos (`qualidadeDados`, `movimentacaoDoMes`) e três seções novas no
  texto gerado: "Movimentação real deste mês" (entradas e despesas de
  verdade, por categoria), "O que estou pagando por dívida agora"
  (`custoMensalCentavos` + `parcelaAtual`/`totalParcelas` de cada
  passivo ativo) e "Qualidade dos dados" (transações sem
  categoria/vínculo, passivos com reconciliação pendente ou sem
  confirmação há 60+ dias) — pra IA saber quando um número pode estar
  defasado em vez de tratá-lo como fato absoluto.
- Testado com dado real local (`scratch-test-resumo-ia.ts`,
  descartável, apagado depois): saída conferida linha a linha —
  entradas R$110.708,82 e despesas R$85.052,23 do mês, 17 passivos
  listados com custo mensal, 14 sem confirmação há 60+ dias, 156
  transações sem categoria e 1364 sem vínculo. Cruzei
  `despesasTotalCentavos` contra a soma de `/ofensores`: bateu
  diferente por R$644,53 — não é bug, é exatamente as despesas do mês
  sem categoria (que `/ofensores` também não consegue agrupar), o que a
  própria seção "Qualidade dos dados" já avisa.
- `npx tsc --noEmit` limpo. Nenhum outro caller de `gerarResumoMarkdown()`
  existia no repo.

## Bug real: reconciliação cega a pagamentos anteriores ao reset de `createdAt` + evolução visível por dívida

Felipe reportou a sensação de "enxugar gelo" — tem certeza que está
pagando dívidas (ex: ~R$60 mil no Oluwo), mas o sistema não mostrava
nenhuma evolução, nem gráfico nem comparação passado/presente.
Investigando achei duas causas reais, não só percepção.

**Causa 1 (bug confirmado)**: `calcularReconciliacaoPassivo()`
(`src/lib/passivoReconciliacao.ts`) usava `passivo.createdAt` como data
de corte pra buscar pagamentos vinculados, quando não havia nenhum
`PassivoHistorico` ainda. Só que o `createdAt` de **todos** os passivos
foi resetado pra 09/09/2026 (dia da auditoria/seed) — depois de meses
de transações reais já importadas com data anterior a essa. Resultado:
pagamentos reais vinculados ficavam invisíveis porque a data de corte
era posterior à própria data do pagamento. Confirmado com query direta
no banco: **8 passivos afetados, R$468.365,27 em pagamentos reais que
nunca entravam na reconciliação** (Leka 1, Agiota, Itaú Personnalité
Black, Oluwo, Empréstimo pessoal Itaú, e 3 dos Consignados Itaú).

- Fix em `src/lib/passivoReconciliacao.ts`: quando não há
  `PassivoHistorico`, o corte agora é `min(createdAt, data da
  transação vinculada mais antiga)` em vez de só `createdAt` — nunca
  inventa valor, só evita descartar uma transação real por causa de uma
  data de cadastro pouco confiável.
- Verificado contra o banco real (script descartável, apagado depois):
  7 dos 8 passivos passaram a sugerir corretamente um novo saldo
  (ex: Oluwo — R$133.800,00, batendo com R$165.000 − R$31.200 pagos).
  O 8º (Agiota) continua sem sugestão **corretamente**: é
  `SO_JUROS_SEM_AMORTIZACAO`, e os R$135.000 pagos ainda não atingem o
  total de R$172.500 — esse tipo de dívida só abate quando quita de uma
  vez, não é bug.
- Efeito colateral automático (sem tocar em nenhum dos três arquivos):
  o banner "pagamento pendente de confirmação" do `/consultor`, o mesmo
  banner na própria página do passivo, e a seção "Qualidade dos dados"
  do resumo de IA (adicionada nesta mesma sessão) passaram a mostrar os
  7 passivos corretamente.
- **Não confirmei nenhuma reconciliação automaticamente** — isso mudaria
  o saldo documentado de dívidas reais sem revisão do Felipe. O fix só
  faz o alerta aparecer certo; confirmar cada uma (fluxo
  "Quitar/Amortizar" já existente) continua sendo decisão dele.

**Causa 2**: o gráfico de trajetória real de saldo já existia
(`calcularTrajetoriaRealPassivo()` em `src/lib/ofensores.ts`,
componente `TrajetoriaCredorChart`), mas só era usado dentro de
`/ofensores` — nunca na própria página do passivo, o lugar óbvio pra
olhar "como essa dívida está evoluindo". Sem nenhum `PassivoHistorico`
confirmado (causa 1), o gráfico também não tinha o que desenhar.

- `src/app/passivos/[id]/page.tsx`: nova seção "Evolução" logo após o
  cabeçalho/métricas, antes do bloco "Quitar/Amortizar" — reaproveita
  `calcularTrajetoriaRealPassivo()` + `TrajetoriaCredorChart` (sem
  projeção, só o que já aconteceu) e mostra "Total pago desde o
  início". Quando só há 1 ponto (sem histórico confirmado ainda), uma
  mensagem explicando o motivo em vez de gráfico vazio, apontando pro
  bloco de confirmação logo abaixo.
- `src/app/resumo/ia/page.tsx` + `src/lib/resumoIA.ts`: nova seção
  "Evolução por dívida (o que já foi pago de verdade)" no resumo pra
  IA — pra cada passivo ativo, "começou em R$X (data), hoje R$Y — já
  pago R$Z" quando há histórico real, ou "ainda sem histórico
  confirmado" quando não há, pra IA nunca confundir "sem histórico" com
  "não está pagando".
- Testado visualmente contra o servidor de dev real (`curl` no
  `/passivos/[id-oluwo]`, `/consultor`, `/resumo/ia`): as três telas
  refletem exatamente o esperado — banner de reconciliação com
  R$133.800,00 sugerido pro Oluwo, banner do Consultor listando os 7
  passivos, resumo de IA com a seção de evolução e a lista de
  pendências batendo com a query SQL feita na investigação.
- `npx tsc --noEmit` limpo.
- Deploy pra VPS: sem migração de schema nova (nenhum campo Prisma
  criado) — só código.

## Achar a transação certa pra conciliar (débito automático "sumindo")

Felipe perguntou por que débito automático não aparecia pra conciliar.
Duas causas reais, achadas por investigação direta no banco:

**1. Truncamento silencioso.** O dropdown "Transação de pagamento" em
`/passivos/[id]` (query `transacoesCandidatas`) usava `take: 40` sobre
um total de 761-812 transações de despesa sem vínculo no banco real —
se a transação procurada não estivesse entre as 40 mais recentes, ela
simplesmente não aparecia, sem aviso nenhum. Confirmado: as 18
transações de débito automático do extrato ("DEB AUTOR GLOBO COM" etc)
foram importadas certinho (tipo DESPESA, sem vínculo,
`EXTRATO_IMPORTADO`), só ficavam fora da janela de 40.

- Removido o `take: 40` da query.
- `src/app/passivos/[id]/SeletorTransacaoPagamento.tsx` (novo,
  componente cliente): campo de busca por texto (filtra por
  descrição/data/valor no navegador, `useMemo`) + o `<select
  name="transacaoId">` já filtrado, mostrando "X de Y transação(ões)"
  — nunca mais um corte invisível. Continua um `<select>` HTML normal
  dentro do mesmo `<form action={confirmarPagamentoPassivo...}>`, sem
  mudar nada no back-end.
- Verificado: página do Oluwo agora mostra "761 de 761 transação(ões)"
  (antes seriam só 40).

**2. Consignado nunca vai aparecer no extrato — limitação estrutural,
não bug.** Desconto em folha acontece antes do salário cair na conta;
confirmado zero transações no banco contendo "CONSIGNADO". A mensagem
antiga ("importe o extrato primeiro") era enganosa pra esse caso — mas
como `transacoesCandidatas` inclui todas as transações sem vínculo do
sistema inteiro (não só desse passivo), a lista praticamente nunca fica
vazia, então um aviso só no estado "vazio" nunca apareceria de verdade
pra esses 6 passivos. Corrigido: quando o passivo tem `cronograma`
(hoje só os 6 Consignados Itaú), um aviso fixo aparece sempre nessa
seção — não só no caso vazio — explicando o motivo e apontando pra
estimativa por cronograma como caminho certo.
- Verificado: página de um dos Consignados mostra o aviso; página do
  Oluwo (sem cronograma) não mostra.
- `npx tsc --noEmit` limpo.

## Dashboard prático: dívida antes vs agora + balanço real do mês

Felipe continuou com a sensação de "enxugar gelo" mesmo sabendo de
cabeça que a dívida caiu de ~R$1,4mi pra ~R$1.281.000 — porque só ele
guardava esse número, o sistema não. Achei que os dados pra resolver
isso já existiam, só nunca tinham virado uma visão de "antes vs agora":
`PatrimonioSnapshot` já guarda `passivoTotalCentavos` por mês (só o
patrimônio líquido era mostrado, nunca a dívida isolada), e a
"movimentação real do mês" (`calcularMovimentacaoDoMes`, construída
mais cedo nesta sessão) só existia como texto no resumo de IA, nunca
como card visual na home.

- `prisma/schema.prisma`: `PatrimonioSnapshot.confiabilidade Confiabilidade?`
  (novo, opcional, reaproveita o enum já existente) — distingue um
  snapshot calculado dos dados reais (mês corrente) de um documentado
  de memória (mês passado). Migração `patrimonio_snapshot_confiabilidade`.
- `src/app/(mapa)/actions.ts`: nova action `registrarSnapshotHistorico`
  — deixa documentar AGORA um mês passado que o Felipe lembra de cabeça
  (dívida total obrigatória, ativos opcional, patrimônio calculado a
  partir dos dois), sempre `confiabilidade: ESTIMADO`, rejeitando mês
  corrente/futuro (esse já tem o botão de sempre). Sem isso, a
  comparação "antes vs agora" ficaria travada em 1 ponto só por meses.
- `src/app/(mapa)/page.tsx`: bloco "Você deve X hoje" virou um painel
  de verdade — tiles "Dívida hoje" / "Dívida no snapshot mais antigo" /
  "Variação" (R$, verde se caiu) quando há mais de 1 snapshot, com aviso
  claro + link pro formulário de mês anterior quando só há 1. Novo card
  "Balanço deste mês (extrato real)" — entradas/despesas/saldo reais,
  ao lado do "Fluxo do mês" já existente (que é projeção/configuração,
  rotulado como tal pra não confundir os dois). Novo gráfico "Dívida
  total documentada, mês a mês" reaproveitando `GraficoLinhaTemporal`
  (já genérico, usado em `/ofensores`/`/otimizacao` — nenhum componente
  novo de gráfico). Formulário de mês anterior num `<details>`
  recolhível perto do botão "Registrar patrimônio deste mês".
- `src/app/(mapa)/Termometro.tsx`: pontos com `confiabilidade: ESTIMADO`
  (lembrados de memória) ganham círculo vazado em vez de preenchido no
  gráfico de patrimônio, com tooltip explicando a diferença — nunca se
  misturam visualmente com um valor calculado de verdade.
- Testado com script descartável (`scratch-test-dashboard-dividas.ts`,
  apagado depois): `registrarSnapshotHistorico` cria o snapshot com
  `confiabilidade: ESTIMADO`, calcula patrimônio corretamente
  (ativo − passivo), rejeita corretamente tentativa de documentar o mês
  corrente, e o registro de teste foi removido e confirmado ausente ao
  final.
- Testado visualmente contra o banco real local (inserindo e depois
  removendo um snapshot de teste via `sqlite3`, banco confirmado voltando
  a 1 registro no final): com 2 snapshots, a tile "Variação" mostrou
  corretamente R$ 138.934,97 e a marca "(lembrado)" apareceu no gráfico
  e na legenda pro ponto histórico.
- `npx tsc --noEmit` limpo (um erro solto de `LayoutProps` era só cache
  `.next/types` obsoleto depois do `rm -rf .next` pós-migração — sumiu
  ao rodar o dev server de novo, não era erro real de código).

## Card "Resumo do ano" no Mapa

Felipe perguntou se fazia sentido ter um card com saldo e total pago no
ano vigente, resetando a cada ano. Fazia sentido e saiu barato: as duas
funções que o card precisava já existiam, só nunca tinham sido chamadas
com o período "ano" — `calcularMovimentacaoDoMes(inicioDoPeriodo("ano"))`
(apesar do nome, funciona pra qualquer intervalo) e
`calcularOfensoresPorCredor(inicioDoPeriodo("ano"))`. Como
`inicioDoPeriodo("ano")` sempre calcula a partir do ano corrente
(`new Date().getFullYear()`), o card já muda sozinho na virada do ano,
sem nenhuma lógica de reset.

- `src/app/(mapa)/page.tsx`: novo card "Resumo de {ano}" logo depois do
  "Balanço deste mês" — Entradas/Despesas/Saldo do ano (mesmas duas
  chamadas acima) e "Pago em dívidas" (soma de
  `calcularOfensoresPorCredor` excluindo o bucket `sem-vinculo` —
  subconjunto das despesas, não um valor à parte).
- Verificado com dado real: Entradas R$1.487.211,83, Despesas
  R$1.705.887,95, Saldo -R$218.676,12, Pago em dívidas R$497.335,15 —
  conferida a checagem de sanidade "pago em dívidas ≤ despesas do ano".
- `npx tsc --noEmit` limpo. Nenhuma migração de schema — só reaproveita
  funções e o campo `Periodo` que já existiam.

## Relatório por categoria (despesa e receita, por período)

Felipe pediu um relatório pra filtrar por categoria (despesa e
receita) e por período (mês, 6 meses, ano) pra achar onde cortar e
sobrar mais pra dívida. Quase tudo já existia — `/ofensores` já tinha o
seletor de período e o agrupamento por categoria raiz+subcategoria, só
nunca tinha sido generalizado pra receita nem exposto como filtro de
categorias específicas.

- `src/lib/ofensores.ts`: `Periodo` ganhou `"semestre"` (6 meses,
  mesmo padrão do `"trimestre"` que já existia pra 3 meses).
  `calcularMaioresOfensores(desde, tipo: TipoTransacao = DESPESA)`
  ganhou o parâmetro `tipo` com valor padrão — as duas chamadas
  existentes (`/ofensores`, `/relatorio`) continuam funcionando sem
  mudar nada, e agora dá pra chamar com `ENTRADA` também.
- `src/app/ofensores/page.tsx` e `src/app/transacoes/page.tsx`:
  atualizados só pra incluir `"semestre"` no `Record<Periodo, string>`
  e na validação do parâmetro de URL (o TypeScript já obrigou essa
  atualização — `Record` exaustivo pegou os dois lugares que precisavam
  mudar).
- `src/app/relatorio/categorias/page.tsx` (novo): período (mesmo
  padrão de `Link`+`?periodo=`), duas seções lado a lado — "Despesas
  por categoria" e "Receitas por categoria" — cada uma usando
  `calcularMaioresOfensores` com o tipo certo; card "Saldo do período"
  no topo; formulário de filtro com checkboxes agrupadas por Despesa/
  Receita (usando `calcularTipoPredominantePorCategoria`, que já
  existia em `src/lib/categorias.ts`, pra separar automaticamente qual
  categoria é de qual lado, mesmo sem campo `tipo` no schema).
  **Autocorreção**: comecei escrevendo isso direto em
  `src/app/categorias/page.tsx` sem checar antes se a rota já existia —
  existia, e não era vazia: era a página de CRUD de categorias
  (listar/criar/editar/excluir, com `actions.ts`, `CategoriaForm.tsx`,
  `novo/`, `[id]/editar/`). Sobrescrevi sem querer, percebi pelo
  `git status` mostrando "modified" em vez de "new file", restaurei
  com `git checkout HEAD --` antes de qualquer commit (nada perdido,
  nada chegou a ir pro git) e recriei o relatório novo em
  `src/app/relatorio/categorias/` — rota que não colide com nada.
- Filtro: marcar a categoria raiz mostra ela inteira (todas as
  subcategorias, total original); marcar só subcategorias específicas
  recalcula o total pra refletir exatamente o que foi escolhido.
  Nenhuma marcada = mostra tudo.
- Verificado contra o servidor real: sem filtro, Receitas R$110.708,82
  / Despesas R$84.407,70 / Saldo R$26.301,12 (a pequena diferença pro
  "Balanço deste mês" do Mapa é esperada — aqui só soma o que tem
  categoria, igual `/ofensores` já fazia). Filtrando só "Moradia"
  (categoria raiz): mostra as 3 subcategorias e o total inteiro
  (R$13.677,33). Filtrando só a subcategoria "Potiguara": recalcula
  pra R$7.509,89, só ela.
- Links novos: `/ofensores` → `/relatorio/categorias` e
  `/relatorio/categorias` → `/ofensores` (pras ferramentas que só fazem
  sentido pra despesa: orçamento, trajetória por credor, comparativo
  mensal); rodapé do Mapa também linka pra `/relatorio/categorias`.
- `npx tsc --noEmit` limpo. Nenhuma migração de schema.
- **Faltou o menu lateral** — Felipe entrou direto pela URL, não achou
  no menu, e perguntou. `src/components/AppSidebar.tsx` tem uma lista
  fixa (`NAV_GROUPS`) que eu não tinha tocado; os links que adicionei
  (rodapé do Mapa, topo de `/ofensores`) são fáceis de não notar.
  Adicionado item "Relatório por categoria" no grupo "Ferramentas",
  logo depois de "Maiores ofensores".

## Cofre de dívida: rateio automático de 50% da receita de Religião

Insight do Felipe: ao ver no relatório por categoria que recebeu
~R$600 mil de Religião em 6 meses, quis separar 50% de toda receita
dessa categoria numa conta à parte (Bradesco), tratando essa
transferência como reserva já comprometida com quitar dívida — nunca
como despesa. Pediu que Consultor, Score, resumo pra IA e uma página
dedicada entendessem essa dinâmica.

O mecanismo exato levou algumas idas e vindas na conversa (saldo vs.
extrato) até fechar: **você marca manualmente** cada transação de
transferência com a conta destino (mesma tela que já marca
"transferência", campo novo) — o sistema nunca adivinha pela
descrição. Isso significa nenhuma mudança em como o extrato é
importado, só um campo a mais pra classificar depois.

- `prisma/schema.prisma`: `Transacao.contaDestinoId` (pra qual conta
  foi uma transferência), `Configuracao` ganha 4 campos da regra
  (`categoriaRateioId`, `percentualRateio`, `contaRateioDestinoId`,
  `rateioAtivoDesde` — gravado uma vez só, nunca retroativo), e
  `Meta.contaOrigemId` (uma meta pode declarar de qual conta o
  dinheiro dela vem). Migração `cofre_rateio_dividas`.
- Conta "Bradesco" criada de verdade (tipo `POUPANCA`, saldo em
  branco) — dado real que o Felipe descreveu, não fabricado.
- `src/app/transacoes/TransacaoSheet.tsx` + `TransacoesTable.tsx` +
  `page.tsx`: campo "Conta destino" na edição de uma transação,
  salvo por `atualizarTransacao`.
- `src/app/contas/actions.ts` + `page.tsx`: nova action
  `atualizarSaldoConta` — pedido separado do Felipe, `/contas` nunca
  teve nenhum jeito de editar saldo, só mostrar.
- `src/lib/rateio.ts` (novo): `calcularStatusRateio()` — recebido na
  categoria, meta (%), depositado (soma das transações marcadas),
  falta separar, saldo atual da conta, e `dividaQuitavel`: quando o
  saldo do cofre já cobre algum passivo ativo inteiro, escolhe **o de
  maior ofensor real nos últimos 6 meses** entre os que cabem no saldo
  (reaproveita `calcularOfensoresPorCredor`, não inventa ranking novo)
  — não necessariamente o de menor saldo.
- `src/app/consultor/page.tsx`: nova seção "Reserva pra dívida" com os
  indicadores + `dividaQuitavel` em destaque quando existe, e um
  formulário recolhível pra configurar/editar a regra.
- `src/lib/score.ts`: rebalanceado (Reserva de emergência 25, Margem
  livre 25, Cheque especial 20, Fatura de cartão 20, **Reserva pra
  dívida 10** — mantendo 100 no total). `rateioOk` é sempre `true`
  quando a regra não está configurada, nunca penalizando quem não usa
  o recurso.
- `src/lib/resumoIA.ts`: nova seção "Reserva pra dívida" no resumo pra
  IA, só aparece com a regra configurada.
- `src/app/cofre/page.tsx` (nova página): os mesmos indicadores +
  metas financiadas por essa conta (reaproveita
  `Meta`/`calcularProgressoMeta`/estilo visual de `/metas`, sem
  duplicar nada) + formulário pra criar uma meta nova já com
  `contaOrigemId` preenchido. Link adicionado direto no
  `AppSidebar.tsx` e no rodapé do Mapa desta vez, sem esquecer o menu
  (lição da entrada anterior).
- Testado com script descartável (`scratch-test-rateio.ts`, apagado
  depois) contra dados sintéticos isolados: sem regra → `null`; regra
  sem depósito → falta = meta inteira; depósito marcado → soma
  corretamente; saldo cobrindo um passivo de teste → `dividaQuitavel`
  aponta pro de maior gasto real recente, não o de menor saldo;
  reconfigurar a regra não reescreve `rateioAtivoDesde`. Todos os
  dados de teste (passivo, transações, saldo, config) removidos e
  confirmados ausentes ao final.
- Regra real configurada com os valores que o Felipe pediu (Religião -
  Receita, 50%, Bradesco) — `rateioAtivoDesde` = agora, então não
  cobra retroativo dos ~R$600k já recebidos e gastos antes disso.
- Verificado visualmente: `/consultor`, `/cofre`, `/contas`,
  `/transacoes` e `/resumo/ia` respondendo 200 com os números
  corretos (meta R$0,00 porque ainda não passou nenhuma receita desde
  a ativação, como esperado).
- `npx tsc --noEmit` limpo.

## Correção: "Conta destino" invisível na tela de visualização da transação

Felipe importou o extrato, achou a transação do PIX pro Bradesco, mas
não achou o campo "Conta destino" — mandou print confirmando. Causa:
eu só tinha colocado o campo no modo de **edição** do `TransacaoSheet`
(depois de clicar no lápis); a tela de visualização que abre ao clicar
"ver" (o primeiro lugar que qualquer um olha) nunca mostrava esse dado,
mesmo quando já preenchido.

- `src/app/transacoes/TransacaoSheet.tsx`: a visualização agora mostra
  "Conta destino" (nome da conta, resolvido a partir de `contas` que já
  chegava como prop) sempre que a transação está marcada como
  transferência — com um aviso "não marcada — clique em editar" quando
  ainda não foi definida, apontando direto pra onde resolver.
- Confirmado na VPS via SSH (leitura) que o build de produção já tinha
  o campo certo compilado (`grep` em `.next/server/chunks/` achou
  "Conta destino" nos chunks de `transacoes` e `consultor`) — não era
  problema de deploy, só de descoberta na UI.
- `npx tsc --noEmit` limpo.

## Correção: formulário do rateio derrubava a página inteira

Felipe tentou configurar a regra do rateio na VPS duas vezes (mesmo
depois de recarregar a página) e a tela crashava com erro genérico do
Next.js. Confirmei via `pm2 logs` na VPS (leitura): era o próprio erro
de validação que eu escrevi (`"Preencha categoria, percentual (1-100) e
conta destino."`), sem tratamento nenhum no formulário — qualquer erro
lançado por uma server action num `<form action={...}>` simples vira
crash de página inteira no Next.js, não um aviso amigável.

Causa raiz: o campo "% a separar" (`src/app/consultor/page.tsx`) não
tinha `required`, e usava `placeholder="50"` — visualmente idêntico a
já estar preenchido com 50, mas na verdade vazio. Sem clicar e digitar
ali, o campo ia em branco e batia direto na minha validação.

- Trocado `placeholder="50"` por `defaultValue={... ?? 50}` (valor real
  já preenchido, não sugestão visual) e adicionado `required` — o
  navegador agora bloqueia o envio com aviso nativo em vez de deixar
  chegar vazio no servidor.
- Confirmei também, nessa investigação, que o banco da VPS nunca teve a
  regra salva (só o meu banco local, de um passo anterior — decisão
  sem efeito nenhum na VPS, que é a fonte real que o Felipe usa).
  Deixado pro Felipe configurar pela UI já corrigida, não fiz a
  escrita direto no banco de produção sem confirmação explícita.
- `npx tsc --noEmit` limpo.

## Integração real com Gemini: sugestão de corte de gastos

Decisão revertida de propósito. Desde o início do projeto havia uma
regra permanente de nunca integrar IA generativa paga (custo por uso +
não mandar dado financeiro pra fora) — `/consultor` é "matemática
pura, sem IA generativa" e `/resumo/ia` sempre foi só copiar-e-colar
manual. Depois de eu entregar uma análise de corte de gastos sem
nenhuma IA (usando só os números reais do relatório por categoria),
Felipe pediu especificamente uma chamada de verdade ao Gemini pra
sugerir cortes — perguntei duas vezes, deixando claro que isso reverte
a decisão anterior, e ele confirmou de forma explícita as duas vezes
("Quero mesmo um plano de integração com Gemini"). Essa é a primeira
chamada de API externa deste projeto inteiro (confirmado: nenhum
`fetch` a terceiros existia em lugar nenhum do código antes disso).

- `.env`/`.env.example`: `GEMINI_API_KEY` novo (Felipe precisa pegar a
  chave dele em https://aistudio.google.com/apikey e também adicionar
  no `.env` da VPS — não fiz essa parte sozinho, é segredo de
  produção).
- `src/lib/gemini.ts` (novo): `chamarGemini(prompt)` — `fetch` nativo
  pra API REST do Gemini (`gemini-3-flash-preview` por padrão,
  configurável via `GEMINI_MODEL`), sem SDK novo. Timeout de 30s, erro
  de chave ausente/API fora/resposta vazia sempre vira uma `Error` com
  mensagem legível — nunca deixa vazar stack trace bruto.
- `src/lib/promptCorteDeGastos.ts` (novo): monta o prompt só com
  totais agregados (despesa por categoria do mês, custo mensal e taxa
  de cada dívida ativa, margem livre, saldo do cofre) — reaproveita
  `calcularMovimentacaoDoMes`/`estado.passivosAtivos`/`calcularStatusRateio`,
  nenhum dado novo calculado. **Nunca envia transação individual** —
  verificado com script descartável (apagado depois): o prompt gerado
  com dado real local não tem nenhuma descrição/data de transação, só
  os agregados por categoria.
- `src/app/resumo/ia/actions.ts` (novo) + `SugestaoIA.tsx` (novo,
  componente cliente): botão "Gerar sugestão com IA (Gemini)" chamando
  a action dentro de `try/catch` — igual ao padrão do `TransacaoSheet`,
  nunca um `<form action>` puro que pode derrubar a página (a mesma
  categoria de bug que acabamos de corrigir no formulário do rateio).
  Testado com script descartável: sem `GEMINI_API_KEY` configurada, o
  erro chega como mensagem clara ("GEMINI_API_KEY não configurada...
  https://aistudio.google.com/apikey"), nunca uma página quebrada.
- `src/app/resumo/ia/page.tsx`: nova seção abaixo do bloco de
  copiar-e-colar já existente, com aviso explícito do que sai da
  máquina e que tem custo por chamada — os dois caminhos continuam
  existindo lado a lado, um não substitui o outro.
- Decisão consciente de **não** tocar na descrição do `/consultor`
  ("sem IA generativa") — essa página continua só matemática local; a
  chamada de IA vive isolada em `/resumo/ia`.
- `npx tsc --noEmit` limpo.
- **Pendência do Felipe**: adicionar `GEMINI_API_KEY` no `.env` da VPS
  pra funcionar em produção — sem isso o botão aparece mas falha com a
  mensagem clara de chave ausente (comportamento esperado, não bug).
