"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AJUDA_CONTEUDO } from "@/lib/ajudaConteudo";

export function HelpSheet({ className }: { className?: string }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Ajuda" className={className} />}>
        <HelpCircle className="size-4" />
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Ajuda</SheetTitle>
          <SheetDescription>O que cada tela faz e como usar.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
          {AJUDA_CONTEUDO.map((grupo) => (
            <div key={grupo.label}>
              <p className="text-xs font-medium uppercase tracking-wide text-gold">{grupo.label}</p>
              <div className="mt-2 flex flex-col gap-4">
                {grupo.paginas.map((pagina) => (
                  <div key={pagina.href}>
                    <Link href={pagina.href} className="text-sm font-medium text-foreground underline underline-offset-4">
                      {pagina.titulo}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">{pagina.resumo}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">{pagina.comoUsar}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
