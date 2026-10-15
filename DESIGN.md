# DESIGN.md — Sistema visual do Gestor Financeiro

**Experimento (branch `feat/design-vimeo`, 15/10/2026):** o Gestor usa o design system "Vimeo" do Felipe, descrito na
skill `vimeo-design` (`~/.claude/skills/vimeo-design/`, origem: o painel do Movies). É o mesmo experimento já feito no
CRM. O visual anterior (Baba Ifá, 08/10/2026) continua guardado na tag de backup. A estrutura não mudou: menu lateral
em grupos, sheets, ajuda "?", gráficos sempre com tabela, cores com significado e contraste AA.

Antes de mexer no visual, leia a skill (`SKILL.md` e o arquivo do assunto em `references/guide/`). Não copie o que está
em `references/guide/99-divergencias.md`.

## Tokens (`src/app/globals.css`)
Claro = `:root`, escuro = `.dark` (classe posta no `<html>` pelo script do layout raiz, antes da pintura). Valores em
hex, com os **mesmos nomes** de variável que o Gestor já usava (`--background`, `--surface`, `--surface-2`,
`--liquidity`, `--debt`, `--gold`, `--chart-1..5`, `--sidebar-*`...). Novos: `--border-soft`, `--border-strong`,
`--brand`, `--brand-text`, `--brand-ink`, `--info`, `--info-soft`, `--shadow-menu`, `--destructive-foreground` e
`--top-inset`.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| background / sidebar | #f4f5f7 | #0f1114 | fundo da página; topo e menu no mesmo fundo, sem divisória |
| card / surface | #ffffff | #1a1d21 | cartões brancos, **sem borda e sem sombra** |
| popover | #ffffff | #202428 | sheets, menus, dicas |
| foreground | #111418 | #f3f4f6 | texto |
| muted-foreground | #5f6670 | #a4abb5 | texto secundário |
| primary | #15181c / texto #fff | #f3f4f6 / texto #111418 | **ação principal preta** (no escuro, clara) |
| secondary / muted / surface-2 | #eceef1 | #262a30 | ação secundária, pílulas, avisos neutros, cabeçalho de tabela |
| accent / sidebar-accent | #e7e9ec | #2f343b / #262a30 | hover; **item ativo do menu em pílula cinza** |
| liquidity (dinheiro entrando) | #036b44 | #4cc795 | verde |
| debt / destructive (dinheiro saindo, dívida) | #b02236 | #f5818b | vermelho |
| gold (pendente, atenção) | #7d5200 | #f0b54a | âmbar |
| brand-text (links) | #006680 | #5bc7f2 | links e "ver mais" (antes eram dourados) |
| input (borda de campo) | #868d96 | #7a818b | >= 3:1 |
| ring | #0a7f9e | #5bc7f2 | foco |
| chart 1-5 | #038153 #1c8cc0 #ad5918 #3353e2 #a81897 | #4cc795 #5bc7f2 #ffb057 #7d9cff #e27fd3 | séries categóricas |

**Cores com significado** (nunca decorativas): verde = dinheiro entrando/quitado, vermelho = dinheiro saindo/dívida,
âmbar = pendente/atenção. Elas ficam em valores, pontinhos, ícones e séries de gráfico; **pílulas e fundos são
neutros** (cinza), sempre com a palavra ao lado (ex.: "pagamento pendente" = pílula cinza com ponto vermelho).

Contraste: `node scripts/contrast.mjs` (sai com código 1 se algo reprovar). Os valores do script precisam bater com
`globals.css`. Alguns pares: texto/fundo 16,9 (claro) e 17,2 (escuro); muted/card 5,8 e 7,3; botão preto 17,8;
liquidity/card 6,6; debt/card 6,7; gold/card 6,8; as três cores sobre o cinza dos avisos >= 5,3; borda de campo/card 3,35.

## Fonte
Inter Tight auto-hospedada (`src/app/fonts/inter-tight-*.woff2`, licença `src/app/fonts/OFL-InterTight.txt`), com
`@font-face` em `globals.css`. Saiu a Nunito do `next/font`; Geist Mono continua para mono. Corpo 16 px / 400;
títulos 700 (`--brand-ink`); título de página 44 px / 800 (32 px no celular), sem sobretítulo; título de seção
(`h2`) 20 px / 700; rótulos sem caixa alta. Números com `num` (600, `tabular-nums`).

## Componentes (`src/components/ui`)
- **Botão:** preto (`default`), cinza (`secondary`), `outline` (borda `--border-strong`), `ghost`, `destructive`
  (vermelho cheio), `link` (`--brand-text`). Raio 12 px, 44 px (48 no `lg`; pequenos crescem para 44 px em tela de
  toque), rótulo normal. No celular o rótulo pode quebrar linha em vez de alargar a página.
- **Campos:** 52 px, raio 12, borda 1 px `--input`, foco com contorno `--ring`. Campos nativos dos formulários usam
  `min-h-[52px] rounded-xl border border-input bg-card px-4 py-3 text-base`.
- **Cartões:** `rounded-2xl bg-card`, sem borda e sem sombra (`Card` e utilitário `glass-card`), padding 24 px.
- **Menus (select):** raio 16, a única sombra larga (`--shadow-menu`).
- **Sheets:** do topo à base (`top-[var(--top-inset)] h-[calc(100dvh-var(--top-inset))]`), `rounded-l-3xl`,
  largura total no celular e até 576 px no computador, fundo sem blur, botão de fechar redondo cinza ("Fechar").
- **Filtros em pílula** (Transações, Maiores ofensores, Relatório por categoria): ativo preto, os outros cinza.
- **Liga/desliga:** o Gestor não tem; se ganhar um, trilho preto (`Switch` da skill).

## Casca
- Menu lateral (`components/ui/sidebar.tsx` + `components/AppSidebar.tsx`): 292 px, fundo da página, itens 17 px com
  ícone lucide de 20 px, ativo em pílula cinza, grupos separados por linha fina, marca na altura do topo, cartão branco
  com o usuário no rodapé. No celular, o mesmo menu abre como sheet pela esquerda.
- Topo (`app/(painel)/layout.tsx`): `sticky top-[var(--top-inset)] h-20 md:h-28 md:pt-6`, mesmo fundo, botões redondos
  de notificações, ajuda "?" e tema.
- `viewport` do layout raiz: `viewportFit: "cover"` e `themeColor` `#f4f5f7` / `#0f1114`.

## Gráficos
SVG próprio (sem Recharts), no estilo do Movies: grade tracejada clara, barras com topo arredondado, legenda com
quadradinho, área com degradê embaixo da linha quando há uma série só, "ver os valores" em caixa cinza. **Todo gráfico
continua com a tabela ou a lista dos números.**

## Desvios em relação ao Movies / à skill
- Menu com **ícones lucide** (o Gestor já usava), não emoji. Não há "+ Criar" nem busca no topo (seriam funções novas).
- O menu usa o `Sidebar` do shadcn: some inteiro ao recolher (não fica em 88 px só com ícones).
- **Valores em dinheiro continuam coloridos** (verde/vermelho/âmbar) no texto: no Gestor o sinal do dinheiro é a
  informação principal. Fundos e pílulas ficaram neutros.
- Cores de gráfico: `chart-1` verde e `chart-2` azul (o Movies começa pelo azul), para o verde continuar sendo a 1ª cor
  como no Gestor. Gráficos de entrada × despesa usam `liquidity`/`debt`, não a paleta.
- Avisos (fora da rota, erro da IA, dicas) viraram caixas cinza com o texto na cor do significado, em vez de caixas
  tingidas.
- Não há `--success`/`--warning` separados: o Gestor já tem `liquidity` e `gold` com o mesmo papel.
- Corrigido junto: `useIsMobile` lia a janela no 1º render e causava "Hydration failed" no celular, o que apagava o
  tema escuro; agora usa `useSyncExternalStore` (sem mudança de comportamento).

## Pendências conhecidas
- Telas de entrada/saída (`/auth/*`) receberam só os tokens e componentes; não foram revisadas uma a uma.
- O gráfico "Evolução mensal" escala o SVG pela largura: com poucos meses os rótulos ficam grandes no computador.
- O termômetro do Meu Mapa com um único ponto ainda mostra uma área vazia grande (comportamento anterior).
