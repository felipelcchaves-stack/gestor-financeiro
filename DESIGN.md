# DESIGN.md — Sistema visual do Gestor Financeiro

Em 08/10/2026, a pedido do dono, o visual MV (verde-esmeralda/DM Sans/glass,
depois dourado/ardósia + Sora/Manrope) foi **substituído** pelo sistema do
**Baba Ifá** (`Baba Ifa/baba-ifa/baba/web/landing/landing.css`). A estrutura do
padrão MV (sidebar em grupos, PageTabs, sheets, ajuda "?", gráficos com tabela,
cores semânticas, regras de acessibilidade AA) continua valendo.

## Tokens (src/app/globals.css)
Claro = `:root` (creme/verde/marrom). Escuro = `.dark` (marrom quente, nunca ardósia).
Verificar com `node scripts/contrast.mjs` (sai com código 1 se algo reprovar).

| Token | Claro | Escuro |
|---|---|---|
| background | #f6f3ee (creme) | #1c1510 |
| card / surface | #ffffff | #261e17 |
| foreground | #2b2118 (marrom) | #f6f3ee |
| muted-foreground | #5f5a52 | #b9afa1 |
| primary (verde) | #1a7f45 / texto #fff | #4cc27f / texto #0b2415 |
| accent (verde-cl) | #e6f6ec / texto #12592f | #2a3a2c / texto #e6f6ec |
| destructive / debt (dinheiro saindo) | #b3261e / #a3321f | #f08a7a |
| liquidity (dinheiro entrando) | #12592f (verde-esc) | #7ccf93 |
| gold (pendente/atenção) | #6b4a00 (amarelo-t) | #f0b54a |
| border | #d6d1c8 | #3f3328 |
| input (borda de campo) | #857e72 | #8c8070 |
| ring | #1a7f45 | #5fd08e |
| charts 1-5 | #1a7f45 #b8661a #2a6fb0 #b08400 #c2457f | #4cc27f #e08a3c #5aa3f0 #f0b54a #e66ba0 |

`chart-2` é a terracota do painel admin da Baba. Verde = dinheiro entrando/aprovado,
vermelho = saindo/estorno, âmbar = pendente/atenção — nunca decorativos.
O verde de texto sobre tints usa `liquidity`/`accent-foreground` (verde-esc),
porque #1a7f45 sobre tint de 10% dá só 4,4:1.

## Contraste (WCAG, razão; mínimo 4,5 texto / 3 foco, borda de campo e gráficos)
Texto/fundo 14,2 (claro) e 16,3 (escuro); muted/card 6,8 e 7,6; botão primário 5,0 e 7,3;
destructive/card 6,5 e 6,7; liquidity/card 8,4 e 8,8; debt/tint 5,9 e 5,7; gold/card 8,1 e 8,9;
ring/fundo 4,6 e 9,4; borda de campo/card 4,0 e 4,3. Lista completa: `node scripts/contrast.mjs`.

## Fonte
Nunito (next/font/google, subsets latin + latin-ext, pesos 400/600/700/800/900), variável
`--font-nunito` para sans/display/heading. Corpo 600, rótulos e botões 800 em caixa-alta com
`letter-spacing .05em`, títulos 900 com tracking `-0.02em`. Geist Mono segue para mono.

## Formas
- Controles (botão, input, select): raio 12px (`--radius: .75rem`), borda de 2px, altura mínima 44px
  (xs/sm menores no desktop, 44px em telas de toque via `pointer: coarse`).
- Botão primário: borda inferior de 4px mais escura (35% de preto); ao clicar desce (borda de 2px).
  Outline/secundário/destrutivo seguem o mesmo "degrau". Variante `link` sem caixa-alta.
- Cards: raio 20px, borda de 2px + inferior de 5px (`Card` e utilitário `glass-card`).
- Badges: pílula, borda de 2px, peso 800.
- Foco: contorno de 3px verde com offset (global `:focus-visible` + componentes).
- Campos nativos usados direto nos formulários recebem borda 2px/raio 12px/44px por regra global
  (fora de `@layer`, para vencer `bg-input/30`).

## Pendências conhecidas
Botões crus (`<button className="rounded-lg bg-primary ...">` em páginas) ainda não têm o degrau 3D;
migrar para `<Button>` quando mexer nessas telas. Não há tela de login nem logo do leão.
