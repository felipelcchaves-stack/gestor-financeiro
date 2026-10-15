// Verifica contraste WCAG dos tokens do tema "Vimeo" (skill vimeo-design; claro e escuro).
// Uso: node scripts/contrast.mjs        -> tabela de razões
//      node scripts/contrast.mjs --css  -> emite os valores oklch dos tokens
// Os valores daqui precisam bater com src/app/globals.css (lá ficam em hex).
const L = {
  bg: "#f4f5f7", card: "#ffffff", pop: "#ffffff", fg: "#111418", mut: "#5f6670", mutbg: "#eceef1",
  pri: "#15181c", prifg: "#ffffff", destr: "#b02236", liq: "#036b44", debt: "#b02236", gold: "#7d5200",
  accent: "#e7e9ec", accfg: "#111418", border: "#e6e8ec", input: "#868d96", ring: "#0a7f9e",
  sbg: "#f4f5f7", brandtxt: "#006680",
  ch: ["#038153", "#1c8cc0", "#ad5918", "#3353e2", "#a81897"],
};
const D = {
  bg: "#0f1114", card: "#1a1d21", pop: "#202428", fg: "#f3f4f6", mut: "#a4abb5", mutbg: "#262a30",
  pri: "#f3f4f6", prifg: "#111418", destr: "#f5818b", liq: "#4cc795", debt: "#f5818b", gold: "#f0b54a",
  accent: "#2f343b", accfg: "#f3f4f6", border: "#2a2e34", input: "#7a818b", ring: "#5bc7f2",
  sbg: "#0f1114", brandtxt: "#5bc7f2",
  ch: ["#4cc795", "#5bc7f2", "#ffb057", "#7d9cff", "#e27fd3"],
};
const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, k) => "#" + rgb(a).map((v, i) => Math.round((v * k + rgb(b)[i] * (1 - k)) * 255).toString(16).padStart(2, "0")).join("");
const pairs = (t) => [
  ["texto / fundo", t.fg, t.bg, 4.5], ["texto / card", t.fg, t.card, 4.5],
  ["muted-foreground / fundo", t.mut, t.bg, 4.5], ["muted-foreground / card", t.mut, t.card, 4.5], ["muted-foreground / muted", t.mut, t.mutbg, 4.5],
  ["botão: primary-fg / primary", t.prifg, t.pri, 4.5], ["primary (texto) / fundo", t.pri, t.bg, 4.5], ["primary (texto) / card", t.pri, t.card, 4.5], ["texto / popover (sheets)", t.fg, t.pop, 4.5], ["muted-foreground / popover", t.mut, t.pop, 4.5], ["brand-text (link) / card", t.brandtxt, t.card, 4.5],
  ["destructive / card", t.destr, t.card, 4.5], ["destructive / destructive 10% s/ card", t.destr, mix(t.destr, t.card, 0.1), 4.5], ["destructive / 15% s/ fundo", t.destr, mix(t.destr, t.bg, 0.15), 4.5],
  ["liquidity (dinheiro entrando) / card", t.liq, t.card, 4.5], ["liquidity / 10% s/ card", t.liq, mix(t.liq, t.card, 0.1), 4.5], ["liquidity / 15% s/ fundo", t.liq, mix(t.liq, t.bg, 0.15), 4.5],
  ["debt (dinheiro saindo) / card", t.debt, t.card, 4.5], ["debt / 10% s/ card", t.debt, mix(t.debt, t.card, 0.1), 4.5], ["debt / 15% s/ fundo", t.debt, mix(t.debt, t.bg, 0.15), 4.5],
  ["gold (pendente/atenção) / card", t.gold, t.card, 4.5], ["gold / 10% s/ card", t.gold, mix(t.gold, t.card, 0.1), 4.5], ["gold / 15% s/ fundo", t.gold, mix(t.gold, t.bg, 0.15), 4.5],
  ["liquidity / secondary (aviso neutro)", t.liq, t.mutbg, 4.5], ["debt / secondary (aviso neutro)", t.debt, t.mutbg, 4.5], ["gold / secondary (aviso neutro)", t.gold, t.mutbg, 4.5], ["liquidity / fundo", t.liq, t.bg, 4.5], ["debt / fundo", t.debt, t.bg, 4.5], ["gold / fundo", t.gold, t.bg, 4.5], ["liquidity / popover", t.liq, t.pop, 4.5], ["debt / popover", t.debt, t.pop, 4.5], ["gold / popover", t.gold, t.pop, 4.5], ["accent-fg / accent", t.accfg, t.accent, 4.5], ["texto / accent (item ativo)", t.fg, t.accent, 4.5], ["sidebar: texto / sidebar", t.fg, t.sbg, 4.5],
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
