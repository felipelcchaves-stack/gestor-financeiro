import { Crown } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

// Telas públicas do login único (aviso, saída, emergência): sem menu e sem nenhum dado financeiro.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center gap-2.5 border-b border-border bg-surface px-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Crown className="size-5" aria-hidden />
        </span>
        <span className="font-display text-sm font-bold">Gestor Financeiro</span>
        <ThemeToggle className="ml-auto" />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
