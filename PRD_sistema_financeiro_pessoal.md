# PRD — Sistema de Gestão Financeira e Quitação de Passivos (Felipe Chaves)

**Status:** Rascunho v3 — ajustado após feedback: (1) o sistema não é só uma ferramenta de reconciliação de dados, é um sistema de gestão ativa com metas, otimização de estratégia de quitação, e prevenção de recaída; (2) a importação de extrato precisa ser mais que leitura crua — cada lançamento é classificado no momento do import (combo box, não pergunta aberta), alimentando um relatório de "maiores ofensores". Ferramenta prática, sem firula — o valor está na inteligência sobre os dados, não em telas bonitas.
**Origem dos dados:** consolidado da auditoria financeira conduzida em chat, com base em documentos reais (contratos, faturas, extratos, prints de app bancário). Onde o dado é estimativa e não fato documentado, está marcado explicitamente.

---

## 1. Problema e objetivo

Hoje o controle financeiro acontece de forma dispersa: memória, mensagens de voz, prints de app bancário passados um a um em conversa. Isso já mostrou dois problemas concretos nesta auditoria: valores citados de cabeça divergiram dos documentos reais repetidamente, e não existia nenhum lugar único mostrando a posição completa.

Mas o objetivo do sistema vai além de corrigir isso. Felipe definiu três coisas que o sistema precisa entregar, e nenhuma delas é opcional:

1. **Um caminho ativo de saída** — não só visualizar a dívida, mas ter metas explícitas de quitação por passivo, e uma indicação clara de progresso: estou no ritmo de bater essa meta ou não.
2. **Decisão de qual dívida atacar primeiro, com matemática, não intuição** — dado o conjunto de passivos, suas taxas e estruturas de juros, o sistema precisa calcular qual ordem de ataque é a mais eficiente (menos juros pago no total, ou dívida zerada mais rápido — os dois critérios, mostrados separadamente, porque nem sempre apontam pra mesma resposta, como já vimos entre Leka 1 e Leka 2).
3. **Não voltar pro buraco** — o sistema precisa monitorar continuamente se o padrão de entrada/saída está sustentável, e alertar antes que a situação se repita, não só depois.

---

## 2. Usuário

Um único usuário: Felipe. Sem multiusuário, permissões ou compartilhamento na v1.

---

## 3. Plataforma e construção — decidido

**Aplicativo web**, acessível por navegador (desktop e celular). Construção: o próprio Felipe, no VS Code, usando Claude Code. Isso significa que este PRD é, na prática, o documento de entrada para essas sessões de desenvolvimento — vale manter as seções 4-6 atualizadas e precisas antes de começar a codar, porque é a partir delas que o código vai ser gerado.

---

## 4. Funcionalidades

### 4.1 Núcleo de dados (fundação — sem isso, nada mais funciona)

**Importação de extrato bancário** — upload de PDF, extração de lançamentos (data, descrição, valor, saldo), deduplicação contra o que já foi importado.

**Classificação assistida no momento do import (não pergunta aberta — combo box)** — este é o ponto que transforma extrato em dado útil. Cada lançamento novo, ao ser importado, é apresentado com uma linha de classificação rápida, não uma pergunta livre tipo "o que é isso?":
- Combo 1 — **tipo:** despesa ou entrada.
- Combo 2 — **categoria:** não é uma lista fechada. O sistema chega com um conjunto inicial de categorias sugeridas (baseado em categorias padrão de mercado em ferramentas de gestão financeira pessoal — moradia, saúde, cartão, empréstimo, religião-receita, religião-despesa, dívida-honra etc. — e refinado pelo que efetivamente aparece nos primeiros extratos importados), mas o combo permite **criar categoria ou subcategoria nova na hora**, direto na tela de classificação, sem precisar ir a uma tela de configuração separada. Isso garante que qualquer tipo de entrada ou saída — inclusive algo que hoje não existe na lista, como um novo tipo de despesa religiosa ou um credor novo — pode ser categorizado no momento em que aparece, e essa categoria nova passa a existir para os próximos lançamentos. A categoria escolhida (existente ou criada ali) é a mesma usada em Orçamento por categoria (4.3) e no motor de metas (4.2).
- Vínculo opcional a um **passivo/ativo/meta cadastrado** — quando o lançamento é reconhecível (ex: PIX recorrente pro mesmo credor), o sistema sugere o vínculo automaticamente com base em lançamentos anteriores já classificados, e Felipe só confirma ou corrige. Isso é sugestão, nunca gravação automática sem confirmação — mesma regra da importação de imagem, pelo histórico de erro de transcrição nesta auditoria.
- Depois da primeira vez que uma descrição de lançamento (ex: "PIX TRANSF ALEKSAN") é classificada, o sistema guarda a associação e sugere a mesma classificação da próxima vez — reduz o trabalho manual de repetir a categorização todo mês.

Sem essa classificação, o extrato é só uma lista de números. Com ela, o sistema consegue gerar o relatório de maiores ofensores (ver 4.3) e alimentar o motor de otimização com dados reais de para onde o dinheiro está indo, não só o que foi cadastrado manualmente.

**Importação de fatura de cartão** — upload de PDF, extração de total, mínimo, parcelamentos em andamento com contador (ex: "18/24"), e valor de "próxima fatura" já projetado pelo banco quando disponível. Parcelamentos que estão na última parcela são sinalizados — representam queda estrutural garantida na fatura seguinte.

**Importação de imagem/print** — upload de screenshot de app bancário, com confirmação manual dos valores extraídos antes de gravar (nunca gravar automaticamente sem revisão, dado o histórico de erro de transcrição nesta auditoria).

**Cadastro de passivos** — nome/credor, tipo, valor de quitação integral, estrutura (amortiza normalmente / só juros sem amortização / sem juros), taxa e custo mensal, parcela e progresso (X/Y pagas), status, documento-fonte. Para cartões/passivos onde o valor mensal não é fixo e conhecido de antemão (ex: Mercado Pago, Sem Parar/Afinz, Porto Seguro), o campo de custo mensal não é obrigatório no cadastro inicial — existe um campo para lançar o valor da fatura/pagamento a cada ciclo, conforme ele chega, em vez de exigir um valor "mínimo mensal" travado desde o início. Decisão de Felipe.

**Cadastro de ativos** — nome, valor, liquidez, vinculação a passivo (ex: CDB dado em garantia de consignado — sinalizar que resgatar reduz a garantia).

**Cadastro de entradas e saídas recorrentes** — salário, receita de religião, receita de cursos, aluguel, plano de saúde, etc., com frequência e confiabilidade (confirmado vs estimado).

### 4.2 Metas e priorização de quitação

Este é o motor central do sistema, não um extra.

**Definição de metas** — Felipe escolhe um ou mais passivos como alvo ativo (ex: "zerar o Agiota"), define data-alvo, e o sistema calcula automaticamente:
- Quanto falta em R$.
- Ritmo necessário de alocação mensal para bater a data-alvo.
- Ritmo real de alocação até agora (com base nas entradas classificadas como destinadas àquele passivo).
- Indicador direto de "no ritmo" / "atrasado" / "à frente" — não deixar isso implícito, mostrar como número: "no ritmo atual, essa meta é atingida em [data projetada]", positiva ou negativamente comparada à data-alvo.

**Motor de otimização — qual dívida atacar primeiro**
Dado o conjunto de passivos ativos e a taxa/estrutura de cada um, o sistema calcula e mostra lado a lado:
- **Critério 1 — menor tempo até dívida zerada:** ordena pelos passivos com menor valor de quitação restante primeiro (o que fecha mais rápido).
- **Critério 2 — menor juro total pago:** simula, para diferentes ordens de ataque, o total de juros acumulado pagos até todas as dívidas-alvo serem quitadas, considerando que passivos sem amortização continuam cobrando juros cheios sobre o saldo total até a quitação integral.
- **Critério 3 — maior alívio de fluxo de caixa mais rápido:** ordena pelos passivos cuja quitação libera a maior parcela mensal primeiro.
Os três critérios ficam visíveis juntos, porque — como já apareceu entre Leka 1 e Leka 2 — eles podem apontar em direções diferentes, e a escolha final é de Felipe, não do sistema. O sistema mostra o trade-off, não decide sozinho.

Este motor herda diretamente os dados de taxa de juros e estrutura já cadastrados no núcleo de passivos — não é um módulo separado com dados próprios.

### 4.3 Prevenção de recaída — saúde financeira contínua

**Relatório de maiores ofensores** — ranking automático, gerado a partir da classificação feita no import (4.1), mostrando: por categoria, quanto saiu no mês/trimestre/ano; dentro de "empréstimo", o ranking por credor (ex: "seu maior gasto com empréstimo é o Agiota, seguido de Leka 1"). É a resposta direta e visível pra pergunta "com o que eu tô gastando mais", sem precisar reconstruir isso de cabeça ou linha por linha de extrato. Esse ranking também alimenta o motor de otimização (4.2) com o custo real de cada frente, não só o valor cadastrado manualmente.

**Orçamento por categoria** — limites definidos por Felipe para categorias de gasto recorrente (moradia, saúde, cartões, religião-despesa, etc.), com acompanhamento de quanto já foi usado no mês.

**Indicador de margem livre mensal** — quanto sobra, todo mês, depois de cobrir obrigações fixas e metas de quitação. Um valor consistentemente perto de zero ou negativo é o mesmo padrão que originou a crise atual — o sistema deveria destacar isso ativamente, não deixar passar em silêncio.

**Alertas de padrão de risco** — sinalizar automaticamente quando: o saldo do cheque especial está sendo usado além da janela sem juros; uma fatura de cartão volta a crescer depois de ter caído estruturalmente; uma nova dívida é cadastrada sem estar vinculada a uma meta ou categoria conhecida (o que teria sinalizado, por exemplo, o empréstimo do Caio Abi Morad ou o "Oluwo" muito antes de aparecerem só quando o extrato foi lido).

**Revisão periódica** — o sistema deveria, no mínimo mensalmente, apresentar um resumo: passivo total mudou quanto, patrimônio líquido (ativos − passivos) mudou quanto, metas no ritmo ou não. Esse número único (patrimônio líquido) é o termômetro de longo prazo de "saindo do buraco" versus "voltando pra ele".

### 4.4 Dashboard visual

- Saldo em conta atual (do último extrato importado).
- Passivo total, segmentado por sangria ativa vs sem sangria.
- Fluxo do mês: confirmado vs projetado vs saídas conhecidas — sempre com a distinção visual entre o que é fato e o que é estimativa.
- Progresso de cada meta ativa (barra + data projetada vs data-alvo).
- Painel de otimização (seção 4.2) acessível a qualquer momento, recalculado com os dados mais recentes.
- Patrimônio líquido ao longo do tempo (gráfico histórico, mês a mês).
- Relatório de maiores ofensores (seção 4.3) — categoria e credor, acessível a qualquer momento.

### 4.5 Fora de escopo (v1)

- Conexão automática via Open Finance/API bancária (considerar em v2).
- Multiusuário ou compartilhamento.
- Recomendação de investimento.
- App mobile nativo (o web app deve funcionar bem em navegador mobile primeiro).

---

## 5. Modelo de dados (alto nível)

- **Conta** (conta bancária, cheque especial, etc.)
- **Transação** (data, valor, descrição, conta, **tipo: despesa/entrada**, categoria, passivo/ativo/meta relacionados, origem: manual/extrato importado/fatura importada/imagem)
- **Passivo** (campos da seção 4.1, incluindo taxa e estrutura de amortização — usados diretamente pelo motor de otimização)
- **Ativo** (campos da seção 4.1)
- **Meta** (passivo(s) alvo, valor-alvo, data-alvo, histórico de alocação)
- **Categoria** (conjunto inicial sugerido pelo sistema — moradia, saúde, cartão, empréstimo com subtipo por credor, religião-receita, religião-despesa, dívida-honra, etc. — extensível: Felipe pode criar categoria/subcategoria nova a qualquer momento, inclusive durante a classificação de um lançamento)
- **Regra de classificação aprendida** (descrição recorrente do extrato → tipo + categoria + vínculo sugeridos automaticamente, com base em classificações anteriores confirmadas por Felipe)
- **Documento** (PDF/imagem original, anexado à transação ou passivo que sustenta — rastreabilidade)

---

## 6. Dados iniciais (seed) — posição consolidada nesta auditoria

> Data de referência: 09/09/2026. Valores marcados **[estimado]** não vêm de documento primário.

### Passivos com sangria mensal ativa (juros corre enquanto não quitar)

| Passivo | Quitação integral | Custo mensal | Observação |
|---|---|---|---|
| Agiota | R$172.500,00 | R$22.500,00 | Binário: paga tudo ou continua pagando juros. Taxa informada 15%/mês (não reconciliada com o custo mensal — diferença de R$3.375,00 ainda em aberto) |
| Leka 1 | R$173.921,80 | R$8.326,94 | Sem amortização. Confirmado por Felipe — bate exatamente com o valor calculado por diferença (R$12.433,06 − R$4.106,12). |
| Leka 2 | R$127.708,03 | R$4.106,12 | Sem amortização. Confirmado por Felipe. |

### Passivo sem sangria mensal (custo é só o valor total)

| Passivo | Quitação integral | Observação |
|---|---|---|
| Oluwo (Thomas Ayoola) | R$165.000,00 | Dívida de honra, sem juros, pagamento flexível no ritmo de Felipe |

### Passivos formais (bancários)

| Passivo | Saldo/parcela | Observação |
|---|---|---|
| 6 consignados Itaú (garantia CDB) | R$466.190,28 saldo devedor / R$13.499,63 por mês | Debita da conta corrente, não do CDB |
| Empréstimo pessoal Itaú | R$1.888,11/mês | Falta pagar R$41.538,42; quitação antecipada por R$30.769,47 |
| Nubank Empréstimo Pessoal | R$1.923,21/mês | 7/48 pagas |
| Nubank Capital de Giro (PJ Fcchaves) | R$2.991,12/mês | 10/24 pagas |
| Financiamento Esmeraldina/Caixa | ~R$2.493,33/mês | Inclui seguro obrigatório |

### Cartões de crédito

| Cartão | Limite utilizado / total documentado |
|---|---|
| Itaú Personnalité Black (3907/1443) | R$56.374,62 |
| Itaú Personnalité Visa Infinite (4831/4766) | ver fatura mais recente |
| Itaú Uniclass Black (5536/7079) | ver fatura mais recente |
| Magazine Luiza/Luizacred | R$1.240,58 |
| Mercado Pago | documentado, mínimo mensal não confirmado |
| Sem Parar/Afinz | R$5.229,30 **[CPF/nome divergente no documento — não totalmente explicado]** |
| Porto Seguro | débito recorrente R$97,30 visto em extrato |

### Cheque especial

- Limite: R$30.852,00 · Taxa: 8% ao mês · Carência: 10 dias sem juros por ciclo, renova todo dia 10.

### Despesas recorrentes mensais confirmadas

| Item | Valor | Observação |
|---|---|---|
| Aluguel (Potiguara) | R$4.762,00 | Temporário — previsão de 2-3 meses até concluir obra do templo e liberar carência de saída |
| Condomínio (Potiguara) | R$1.843,09 | Mesmo prazo do aluguel |
| Plano de saúde (Felipe + esposa) | R$3.368,56 | |
| Plano de saúde (mãe) | R$1.921,91 **[calculado por diferença — R$14.354,97 (PIX ALEKSAN total) − R$8.326,94 (Leka 1) − R$4.106,12 (Leka 2), confere exatamente; ainda não confirmado por documento isolado, mas consistente]** | Embutido no pagamento combinado com Leka |
| Claro (internet/telefone) | R$303,66 | |
| Claro Celular | R$179,04 | |
| Ceg-gás | R$241,49 (varia) | |
| Proteção familiar | R$101,75 | |

**Total de obrigações mensais confirmadas: ~R$51.386,54**

### Receitas

| Fonte | Valor | Confiabilidade |
|---|---|---|
| Salário/pagamento (conta PJ) | ~R$18.000,00 | Confirmado como valor fixo que cai todo mês, recebido em conta PJ; Felipe observa que pode variar conforme horas trabalhadas — o valor exato mês a mês ainda não é 100% travado, mas a recorrência mensal é fato confirmado, não estimativa |
| Religião — baseline histórico | R$25.000,00/mês | **[estimado]** |
| Religião — sazonal adicional (setembro) | R$70.000,00 | Declarado como certo |
| Religião — campanha específica pró-Agiota (setembro) | R$127.500,00 | **[estimado, baixa precisão]** |
| Cursos online (30+ cursos) | R$25.000,00 | Declarado como certo |

### Ativos

| Ativo | Valor | Vinculação |
|---|---|---|
| CDB "Privilege" | ~R$440.497,05 (referência inicial) | Garantia dos 6 consignados Itaú — liquidez D+0, mas resgatar reduz a garantia |

### Meta ativa nº 1 (seed)

- **Alvo:** Agiota
- **Valor-alvo:** R$172.500,00
- **Data-alvo:** setembro/2026 (ou outubro, conforme sobra real)
- **Alocado até agora:** conforme rastreamento de entradas classificadas como "pró-Agiota"

---

## 7. Requisitos não-funcionais

- **Privacidade:** dado financeiro extremamente sensível — dívidas informais, saúde de familiares, endereço. Sem superfície de compartilhamento público por padrão.
- **Rastreabilidade:** todo valor deveria apontar para o documento que o sustenta, ou estar marcado como "não documentado".
- **Histórico de mudança:** quando um valor de passivo muda (o Oluwo mudou 5 vezes nesta conversa), manter histórico, não sobrescrever.

---

## 8. Perguntas em aberto antes de seguir para construção

1. ~~Confirmar plataforma~~ — **Resolvido: web.**
2. ~~Quem constrói~~ — **Resolvido: o próprio Felipe, usando VS Code com Claude Code (desenvolvimento assistido por IA direto no código).**
3. ~~Split individual da parcela de Leka 1 vs Leka 2~~ — **Resolvido: Leka 1 = R$8.326,94, Leka 2 = R$4.106,12, confirmados por Felipe.**
4. ~~Pagamento mínimo mensal dos cartões Mercado Pago, Sem Parar e Porto Seguro~~ — **Resolvido como decisão de produto, não de dado**: esses cartões não terão custo mensal travado no cadastro; o sistema recebe o valor da fatura a cada ciclo, via campo próprio (ver 4.1).
5. ~~Confirmar se o R$18.000,00 é fixo ou variável~~ — **Resolvido: fixo mensal, recebido em conta PJ, com possível variação ligada a horas trabalhadas.**
6. ~~Definir o critério de sucesso principal para o motor de otimização (seção 4.2) por padrão~~ — **Resolvido: menor juro total pago é o critério padrão usado na rota recomendada do Mapa de Saída** (`/`), calculado por `encontrarOrdemMenosJuros` em `src/lib/otimizacao.ts`. Os outros dois critérios (menor tempo, maior alívio de caixa) continuam disponíveis lado a lado em `/otimizacao`, sem serem o padrão.

**Resolvido:** lista de categorias não precisa de validação prévia travada — o sistema sugere um conjunto inicial e permite criação livre de categoria/subcategoria no momento da classificação (ver 4.1/5).
