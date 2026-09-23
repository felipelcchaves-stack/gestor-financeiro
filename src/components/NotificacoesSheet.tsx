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
        <Bell className="size-4" />
        {notificacoes.length > 0 && (
          <span
            className={`absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-background ${
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

        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
          {notificacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada pendente agora.</p>
          ) : (
            notificacoes.map((n, i) => {
              const conteudo = (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    n.severidade === "alerta" ? "border-debt/30 bg-debt/[0.06]" : "border-gold/30 bg-gold/[0.06]"
                  }`}
                >
                  <p className={`font-medium ${n.severidade === "alerta" ? "text-debt" : "text-gold"}`}>{n.titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{n.mensagem}</p>
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
