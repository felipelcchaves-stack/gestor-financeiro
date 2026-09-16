# Gestor Financeiro — Felipe Chaves

Sistema pessoal de gestão financeira e quitação de passivos. Construído a
partir do `PRD_sistema_financeiro_pessoal.md`.

Stack: Next.js (App Router) + TypeScript + Tailwind + Prisma (SQLite local).

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Banco de dados

O banco é um arquivo SQLite local (`dev.db`), nunca versionado (dado
financeiro sensível — ver seção 7 do PRD).

```bash
npx prisma migrate dev     # aplica migrações
npm run db:seed            # repopula com a posição consolidada da auditoria (seção 6 do PRD) — apaga dados atuais
npm run db:studio          # abre o Prisma Studio para inspecionar os dados
```

## Estrutura

- `prisma/schema.prisma` — modelo de dados (seção 5 do PRD).
- `prisma/seed.ts` — dados iniciais (seção 6 do PRD): passivos, ativos,
  recorrências e a meta "Zerar Agiota".
- `src/lib/metrics.ts` — patrimônio líquido, segmentação de passivos por
  estrutura e progresso de metas.
- `src/lib/extrato-parser.ts` — parser de extrato em PDF (layout genérico,
  validado contra um extrato real do Itaú, ver observação abaixo).
- `src/lib/fatura-parser.ts` — "melhor palpite" de total/mínimo/vencimento
  de fatura de cartão em PDF, também sem formato garantido.
- `src/lib/classificacao.ts` — normalização de descrição + hash de
  deduplicação para o import de extrato e de imagem.
- `src/lib/otimizacao.ts` — motor de simulação do critério de quitação
  (seção 4.2) + `encontrarVitoriaRapida` (dívida mais barata de matar perto
  do alívio de caixa que dá).
- `src/lib/margemLivre.ts` — margem livre mensal (entradas recorrentes −
  despesas recorrentes − parcelas dos passivos − aporte de quitação).
- `src/lib/proximaAcao.ts` — motor de "o que fazer agora" (regras
  determinísticas, sem jargão técnico nas mensagens; inclui lembrete de
  revisão periódica).
- `src/lib/sinal.ts` — sinal de rota (verde/amarelo/vermelho), também
  determinístico; considera dados faltando, metas fora do prazo, margem
  livre negativa e patrimônio piorando nos últimos meses.
- `src/lib/alertas.ts` — alertas de padrão de risco (cheque especial,
  fatura crescendo, passivo novo sem meta).
- `src/lib/estadoAtual.ts` — carrega e computa tudo que o Mapa e o
  `/resumo/ia` precisam, num lugar só (evita duplicar a lógica entre as
  duas telas).
- `src/lib/resumoIA.ts` — monta o resumo em markdown pra revisar com IA.
- `src/app/(mapa)/` — a home (`/`): o Mapa de Saída. Route group (parênteses
  não viram segmento de URL) só pra organizar os arquivos.
- `src/app/api/documentos/[id]/route.ts` — serve de volta os PDFs/imagens
  importados, pra rastreabilidade (seção 7 do PRD).
- `src/app/` — demais páginas: Resumo (`/resumo`, o dashboard técnico
  original) e `/resumo/ia` (gerar resumo pra IA), Passivos, Ativos, Metas,
  Contas, Transações, Importar (`/importar` — extrato, fatura, imagem),
  Comparar estratégias (`/otimizacao`), Ataque rápido (`/ataque-rapido`),
  Maiores ofensores (`/ofensores`).

## O que já existe

- **Mapa de Saída** (`/`, a home): a resposta direta a "o que eu faço
  agora" — frase-guia em português simples, sinal de rota, lista de até 3
  próximas ações com botão direto pra tela certa, a trilha visual das
  dívidas na ordem recomendada de ataque, e a "vitória rápida" em destaque.
  Roadmap completo (Phases 0–3) em [`ROADMAP.md`](./ROADMAP.md).
- **Núcleo de dados** (seção 4.1/5): modelo completo, CRUD de Passivos,
  Ativos, Metas e Contas pela UI, com histórico de mudança de valor
  (seção 7 — nunca sobrescreve, sempre registra). Toda tela de cadastro
  agora explica em uma frase quando aquele tipo de registro se aplica.
- **Importação de extrato em PDF** (`/importar/extrato`): upload → parsing →
  deduplicação contra o que já foi importado → revisão e classificação
  obrigatória (tipo, categoria com criação inline, vínculo a
  passivo/ativo/meta) → só grava depois de confirmado. Aprende a
  classificação: a próxima vez que a mesma descrição aparecer, sugere
  automaticamente a mesma categoria/vínculo. Também detecta linhas de
  "saldo do dia" (não são lançamento) e usa o valor mais recente delas pra
  atualizar o saldo da conta, mesmo em bancos que não colocam saldo em
  cada transação.
  - Validado contra um extrato real do Itaú do Felipe: 218 lançamentos
    reconhecidos, 2 linhas não reconhecidas (nenhuma delas era um
    lançamento de verdade). Ainda assim, bancos não têm formato
    padronizado — se um PDF de outro banco não bater com o regex, a tela
    de importação mostra as linhas "não reconhecidas" em vez de descartar
    silenciosamente.
- **Importação de fatura de cartão** (`/importar/fatura`) e **de
  imagem/print** (`/importar/imagem`): fatura tenta achar total/mínimo/
  vencimento por regex e pré-preenche o formulário de ciclo de fatura já
  existente; imagem é sempre manual — sem OCR, o Felipe digita o que vê,
  com a imagem anexada como prova.
- **Dashboard**: passivo total, patrimônio líquido, segmentação por
  estrutura (sangria ativa / amortizando / sem sangria), progresso de metas.
- **Motor de otimização** (`/otimizacao`, seção 4.2): compara os três
  critérios lado a lado — menor tempo até zerar, menor juro total pago
  (busca exaustiva até 7 passivos, heurística acima disso) e maior alívio de
  caixa mais rápido — dado um aporte mensal extra informado na tela.
  Assunções da simulação estão documentadas no topo de `otimizacao.ts`.
- **Ataque rápido** (`/ataque-rapido`): a mesma matemática do motor de
  otimização, mas com interface simples focada só nas dívidas pequenas que
  sugam caixa mês a mês, uma resposta só ("vira pó em X meses") e efeito
  visual de dominó tombando na ordem de ataque.
- **Termômetro de patrimônio + resumo pra IA** (`/resumo/ia`): gráfico de
  tendência do patrimônio líquido mês a mês (registro manual, sem cron) e
  um resumo em markdown pronto pra colar numa conversa e pedir uma segunda
  opinião sobre a rota.
- **Maiores ofensores + orçamento por categoria** (`/ofensores`, seção 4.3):
  ranking de despesas por categoria (com detalhamento por subcategoria —
  Empréstimo por credor, Cartão por cartão) com seletor de período, mais
  orçamento mensal por categoria com acompanhamento de uso.
- **Alertas de padrão de risco** (`src/lib/alertas.ts`, aparecem no Mapa e
  no resumo pra IA): cheque especial em uso, fatura de cartão que voltou a
  crescer, passivo novo sem meta vinculada (com limite anti-ruído pra não
  disparar numa carga em lote de dados).
- **Margem livre mensal** (destaque no Mapa): entradas recorrentes menos
  despesas fixas, parcelas de passivos e aporte de quitação já comprometido.
  Escala o sinal pra vermelho quando fica zero ou negativa — o mesmo
  padrão que o PRD associa à origem da crise.
- **Ver documento original**: link em Transações e no detalhe de cada
  Passivo (documento-fonte, histórico, ciclos de fatura) pra abrir o
  PDF/imagem que sustenta aquele valor. Criar/editar um passivo já permite
  anexar esse documento-fonte diretamente (contrato, comprovante etc.).

## Próximos passos

As phases 0–4 do roadmap (`ROADMAP.md`) estão completas — todo o núcleo do
PRD original mais a camada de orientação (Mapa, sinal, alertas, margem
livre) construída depois do feedback de uso. O que resta agora é uso real:
importar extratos e faturas de verdade regularmente é o que dá substância
pro relatório de maiores ofensores, pro orçamento por categoria e pros
alertas — hoje eles funcionam corretamente mas só têm dado real assim que
houver volume de transações classificadas.
