import type { Metadata } from "next";
import { Sora, Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HelpSheet } from "@/components/HelpSheet";
import { contarSugestoesPendentes } from "@/lib/sugestoesPendentes";

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

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestor Financeiro — Felipe Chaves",
  description: "Sistema de gestão financeira e quitação de passivos",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sugestoesPendentes = await contarSugestoesPendentes();

  return (
    <html
      lang="pt-BR"
      className={`${sora.variable} ${manrope.variable} ${geistMono.variable} h-full antialiased`}
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
      <body className="min-h-full bg-background text-foreground">
        <SidebarProvider>
          <AppSidebar sugestoesPendentes={sugestoesPendentes} />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border bg-surface px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm font-medium text-muted-foreground">Gestor Financeiro</span>
              <HelpSheet className="ml-auto" />
              <ThemeToggle />
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
