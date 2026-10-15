import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const SCRIPT_TEMA_INICIAL = `
(function () {
  try {
    var tema = localStorage.getItem("tema");
    if (tema === "light") return;
    document.documentElement.classList.add("dark");
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

// A fonte do texto é a Inter Tight auto-hospedada (src/app/fonts, licença OFL), declarada em globals.css.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestor Financeiro — Felipe Chaves",
  description: "Sistema de gestão financeira e quitação de passivos",
};

/** `viewport-fit=cover` deixa o navegador informar a área coberta (barras translúcidas, recortes de tela). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Cor da barra do navegador = fundo do painel (design system Vimeo).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1114" },
  ],
};

// Só o esqueleto (fontes, tema). O menu, o cabeçalho e a checagem de sessão ficam em
// (painel)/layout.tsx; as telas de entrada/saída (/auth/*) têm o layout delas, sem dado financeiro.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Precisa ser um <script> literal (não next/script) pra rodar de
            forma síncrona antes de qualquer pintura, evitando flash do tema
            errado — next/script com beforeInteractive não injeta um script
            estático de verdade no dev com Turbopack (vai via payload de
            streaming, roda tarde demais). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
