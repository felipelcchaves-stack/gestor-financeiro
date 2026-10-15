import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HelpSheet } from "@/components/HelpSheet";
import { NotificacoesSheet } from "@/components/NotificacoesSheet";
import { PendenciasWizard } from "@/components/PendenciasWizard";
import { contarSugestoesPendentes } from "@/lib/sugestoesPendentes";
import { carregarNotificacoes } from "@/lib/notificacoes";
import { calcularPendenciasWizard } from "@/lib/pendenciasWizard";
import { exigirSessao } from "@/lib/auth/atual";

// O sistema inteiro é privado: toda tela daqui pra dentro exige sessão (login único pelo Hub).
// A checagem vem ANTES de qualquer consulta ao banco — sem sessão, nenhum dado é lido.
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();
  const [sugestoesPendentes, notificacoes, pendenciasWizard] = await Promise.all([
    contarSugestoesPendentes(),
    carregarNotificacoes(),
    calcularPendenciasWizard(),
  ]);

  return (
    <>
      <SidebarProvider>
        <AppSidebar sugestoesPendentes={sugestoesPendentes} usuario={{ nome: sessao.usuario.nome, email: sessao.usuario.email }} />
        <SidebarInset className="min-w-0">
          {/* Topo do design system "Vimeo": mesmo fundo da página, sem divisória, fixo abaixo da área coberta pelo
              navegador (--top-inset) e com 24px de respiro em cima no computador (h-28 pt-6). */}
          <header className="sticky top-[var(--top-inset)] z-20 flex h-20 shrink-0 items-center gap-2 bg-background px-4 md:h-28 md:px-8 md:pt-6">
            <SidebarTrigger className="rounded-full" />
            <span className="truncate text-[0.9375rem] font-semibold text-muted-foreground md:hidden">Gestor Financeiro</span>
            <NotificacoesSheet notificacoes={notificacoes} className="ml-auto rounded-full" />
            <HelpSheet className="rounded-full" />
            <ThemeToggle className="rounded-full" />
          </header>
          <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pt-2 pb-16 md:px-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <PendenciasWizard pendencias={pendenciasWizard} />
    </>
  );
}
