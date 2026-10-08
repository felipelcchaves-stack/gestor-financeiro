// Verifica contraste WCAG dos tokens do tema Baba (claro e escuro).
// Uso: node scripts/contrast.mjs        -> tabela de razões
//      node scripts/contrast.mjs --css  -> emite os valores oklch dos tokens
const L = {
  bg: "#f6f3ee", card: "#ffffff", fg: "#2b2118", mut: "#5f5a52", mutbg: "#ece7de",
  pri: "#1a7f45", prifg: "#ffffff", destr: "#b3261e", liq: "#12592f", debt: "#a3321f", gold: "#6b4a00",
  accent: "#e6f6ec", accfg: "#12592f", border: "#d6d1c8", input: "#857e72", ring: "#1a7f45",
  sbg: "#fbf9f5",
  ch: ["#1a7f45", "#b8661a", "#2a6fb0", "#b08400", "#c2457f"],
};
const D = {
  bg: "#1c1510", card: "#261e17", fg: "#f6f3ee", mut: "#b9afa1", mutbg: "#32281f",
  pri: "#4cc27f", prifg: "#0b2415", destr: "#f08a7a", liq: "#7ccf93", debt: "#f08a7a", gold: "#f0b54a",
  accent: "#2a3a2c", accfg: "#e6f6ec", border: "#3f3328", input: "#8c8070", ring: "#5fd08e",
  sbg: "#18120d",
  ch: ["#4cc27f", "#e08a3c", "#5aa3f0", "#f0b54a", "#e66ba0"],
};
const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, k) => "#" + rgb(a).map((v, i) => Math.round((v * k + rgb(b)[i] * (1 - k)) * 255).toString(16).padStart(2, "0")).join("");
const pairs = (t) => [
  ["texto / fundo", t.fg, t.bg, 4.5], ["texto / card", t.fg, t.card, 4.5],
  ["muted-foreground / fundo", t.mut, t.bg, 4.5], ["muted-foreground / card", t.mut, t.card, 4.5], ["muted-foreground / muted", t.mut, t.mutbg, 4.5],
  ["botão: primary-fg / primary", t.prifg, t.pri, 4.5], ["primary (texto) / fundo", t.pri, t.bg, 4.5], ["primary (texto) / card", t.pri, t.card, 4.5],
  ["destructive / card", t.destr, t.card, 4.5], ["destructive / destructive 10% s/ card", t.destr, mix(t.destr, t.card, 0.1), 4.5], ["destructive / 15% s/ fundo", t.destr, mix(t.destr, t.bg, 0.15), 4.5],
  ["liquidity (dinheiro entrando) / card", t.liq, t.card, 4.5], ["liquidity / 10% s/ card", t.liq, mix(t.liq, t.card, 0.1), 4.5], ["liquidity / 15% s/ fundo", t.liq, mix(t.liq, t.bg, 0.15), 4.5],
  ["debt (dinheiro saindo) / card", t.debt, t.card, 4.5], ["debt / 10% s/ card", t.debt, mix(t.debt, t.card, 0.1), 4.5], ["debt / 15% s/ fundo", t.debt, mix(t.debt, t.bg, 0.15), 4.5],
  ["gold (pendente/atenção) / card", t.gold, t.card, 4.5], ["gold / 10% s/ card", t.gold, mix(t.gold, t.card, 0.1), 4.5], ["gold / 15% s/ fundo", t.gold, mix(t.gold, t.bg, 0.15), 4.5],
  ["accent-fg / accent", t.accfg, t.accent, 4.5], ["sidebar: texto / sidebar", t.fg, t.sbg, 4.5],
  ["ring / fundo (>=3)", t.ring, t.bg, 3], ["ring / card (>=3)", t.ring, t.card, 3],
  ...t.ch.map((c, i) => [`gráfico chart-${i + 1} ${c} / card (>=3)`, c, t.card, 3]),
  ["borda de campo (--input) / card (>=3)", t.input, t.card, 3], ["borda de campo / fundo (>=3)", t.input, t.bg, 3],
];
if (process.argv.includes("--css")) {
  const ok = (h) => { const [r, g, b] = rgb(h).map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L_ = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const C = Math.hypot(a, bb); let H = (Math.atan2(bb, a) * 180) / Math.PI; if (H < 0) H += 360;
    return `oklch(${L_.toFixed(3)} ${C.toFixed(3)} ${C < 0.002 ? 0 : H.toFixed(0)})`; };
  for (const [n, t] of [["light", L], ["dark", D]]) { console.log(`/* ${n} */`); for (const k in t) if (k !== "ch") console.log(`${k}: ${ok(t[k])}; /* ${t[k]} */`); }
  process.exit(0);
}
let fail = 0;
for (const [n, t] of [["CLARO", L], ["ESCURO", D]]) {
  console.log(`\n## ${n}`);
  for (const [name, a, b, min] of pairs(t)) { const r = cr(a, b); if (r < min) fail++; console.log(`${r.toFixed(2).padStart(6)} ${r >= min ? "ok  " : "FAIL"} ${name}`); }
}
process.exit(fail ? 1 : 0);
