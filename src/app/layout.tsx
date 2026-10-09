import type { Metadata } from "next";
import { Nunito, Geist_Mono } from "next/font/google";
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

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestor Financeiro — Felipe Chaves",
  description: "Sistema de gestão financeira e quitação de passivos",
};

// Só o esqueleto (fontes, tema). O menu, o cabeçalho e a checagem de sessão ficam em
// (painel)/layout.tsx; as telas de entrada/saída (/auth/*) têm o layout delas, sem dado financeiro.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
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
