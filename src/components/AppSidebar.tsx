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
  Sparkles,
  CreditCard,
  Activity,
  List,
  Upload,
  FileText,
  Compass,
  Crown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Crown className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold text-sidebar-foreground">Gestor Financeiro</p>
            <p className="text-[11px] text-muted-foreground">Rota de Saída</p>
          </div>
        </div>
        <SidebarMenu className="mt-3">
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/comecar"}
              render={<Link href="/comecar" />}
              tooltip="Assistente de configuração"
              className="data-active:bg-gold/10 data-active:text-gold"
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
                      className="data-active:bg-gold/10 data-active:text-gold"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
