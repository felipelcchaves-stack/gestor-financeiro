"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map,
  LayoutDashboard,
  ClipboardList,
  TrendingDown,
  PiggyBank,
  Target,
  Wallet,
  Repeat,
  Tags,
  Scale,
  Zap,
  BarChart3,
  PieChart,
  Vault,
  Sparkles,
  CreditCard,
  Activity,
  List,
  Upload,
  FileText,
  Compass,
  Crown,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { href: "/", label: "Meu Mapa", icon: Map },
      { href: "/resumo", label: "Resumo", icon: LayoutDashboard },
      { href: "/relatorio", label: "Relatório", icon: ClipboardList },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { href: "/passivos", label: "Passivos", icon: TrendingDown },
      { href: "/ativos", label: "Ativos", icon: PiggyBank },
      { href: "/metas", label: "Metas", icon: Target },
      { href: "/contas", label: "Contas", icon: Wallet },
      { href: "/recorrencias", label: "Recorrências", icon: Repeat },
      { href: "/categorias", label: "Categorias", icon: Tags },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { href: "/otimizacao", label: "Comparar estratégias", icon: Scale },
      { href: "/ataque-rapido", label: "Ataque rápido", icon: Zap },
      { href: "/ofensores", label: "Maiores ofensores", icon: BarChart3 },
      { href: "/relatorio/categorias", label: "Relatório por categoria", icon: PieChart },
      { href: "/cofre", label: "Cofre", icon: Vault },
      { href: "/consultor", label: "Consultor", icon: Sparkles },
      { href: "/cartoes", label: "Cartões", icon: Activity },
      { href: "/limite-cartao", label: "Limite de cartão", icon: CreditCard },
    ],
  },
  {
    label: "Dados",
    items: [
      { href: "/transacoes", label: "Transações", icon: List },
      { href: "/importar", label: "Importar", icon: Upload },
      { href: "/documentos", label: "Documentos", icon: FileText },
    ],
  },
];

export function AppSidebar({
  sugestoesPendentes = 0,
  usuario,
}: {
  sugestoesPendentes?: number;
  usuario?: { nome: string; email: string };
}) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="gap-0 p-0">
        {/* Marca na altura do topo (h-28 pt-6), como no painel do Movies. */}
        <div className="flex h-28 shrink-0 items-center gap-3 px-6 pt-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
            <Crown className="size-[22px]" aria-hidden />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xl font-extrabold tracking-tight text-sidebar-foreground">Gestor Financeiro</p>
            <p className="text-[0.8125rem] text-muted-foreground">Rota de Saída</p>
          </div>
        </div>
        <SidebarMenu className="px-3 pb-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/comecar"}
              render={<Link href="/comecar" />}
              tooltip="Assistente de configuração"
            >
              <Compass />
              <span>Assistente de configuração</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      render={<Link href={item.href} />}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                      {item.href === "/cofre" && sugestoesPendentes > 0 && (
                        <span className="ml-auto flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-gold px-1.5 text-xs font-semibold text-background tabular-nums">
                          {sugestoesPendentes}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {usuario && (
        <SidebarFooter className="gap-1 p-3">
          <div className="min-w-0 rounded-2xl bg-card px-4 py-3 leading-tight">
            <p className="truncate text-[0.9375rem] font-bold text-sidebar-foreground">{usuario.nome}</p>
            <p className="truncate text-[0.8125rem] text-muted-foreground">{usuario.email}</p>
          </div>
          {/* Sair = encerra a sessão daqui e segue para o "Sair" do Hub (login único). */}
          <form action="/auth/sair" method="post">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<button type="submit" />} tooltip="Sair">
                  <LogOut />
                  <span>Sair</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </form>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
