import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
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
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border bg-surface px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium text-muted-foreground">Gestor Financeiro</span>
            <NotificacoesSheet notificacoes={notificacoes} className="ml-auto" />
            <HelpSheet />
            <ThemeToggle />
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <PendenciasWizard pendencias={pendenciasWizard} />
    </>
  );
}
