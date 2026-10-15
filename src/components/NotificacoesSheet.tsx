"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Notificacao } from "@/lib/notificacoes";

export function NotificacoesSheet({ notificacoes, className }: { notificacoes: Notificacao[]; className?: string }) {
  const temAlerta = notificacoes.some((n) => n.severidade === "alerta");

  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" aria-label="Notificações" className={`relative ${className ?? ""}`} />}
      >
        <Bell className="size-5" />
        {notificacoes.length > 0 && (
          <span
            className={`absolute top-0.5 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-background tabular-nums ${
              temAlerta ? "bg-debt" : "bg-gold"
            }`}
          >
            {notificacoes.length}
          </span>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notificações</SheetTitle>
          <SheetDescription>Alertas, tarefas pendentes e parcelas vencendo — de qualquer página.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-6 pb-6">
          {notificacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada pendente agora.</p>
          ) : (
            notificacoes.map((n, i) => {
              const conteudo = (
                <div className="rounded-2xl bg-secondary p-4 text-[0.9375rem] transition-colors hover:bg-accent">
                  <p className="flex items-center gap-2 font-semibold text-foreground">
                    <span
                      aria-hidden
                      className={`size-2.5 shrink-0 rounded-full ${n.severidade === "alerta" ? "bg-debt" : "bg-gold"}`}
                    />
                    <span className="sr-only">{n.severidade === "alerta" ? "Alerta: " : "Atenção: "}</span>
                    {n.titulo}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{n.mensagem}</p>
                </div>
              );
              return n.href ? (
                <Link key={i} href={n.href} className="block">
                  {conteudo}
                </Link>
              ) : (
                <div key={i}>{conteudo}</div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
