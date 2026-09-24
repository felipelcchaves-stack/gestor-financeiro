"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
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
import { AJUDA_CONTEUDO, type PaginaAjuda } from "@/lib/ajudaConteudo";

// Acha a ajuda da rota atual: match exato primeiro (cobre "/"), senão o
// prefixo mais específico (mais longo) — ex: "/passivos/abc123" cai na
// entrada "/passivos". "/" nunca entra como prefixo de outra rota, senão
// toda página do sistema cairia em "Meu Mapa" por engano.
function encontrarAjudaDaRota(pathname: string): PaginaAjuda | null {
  const todas = AJUDA_CONTEUDO.flatMap((g) => g.paginas);
  const exata = todas.find((p) => p.href === pathname);
  if (exata) return exata;
  const candidatas = todas
    .filter((p) => p.href !== "/" && pathname.startsWith(`${p.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return candidatas[0] ?? null;
}

function Topicos({ topicos }: { topicos: PaginaAjuda["topicos"] }) {
  if (topicos.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      {topicos.map((topico) => (
        <div key={topico.titulo}>
          <p className="text-xs font-medium text-foreground">{topico.titulo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{topico.explicacao}</p>
        </div>
      ))}
    </div>
  );
}

function ListaCompleta() {
  return (
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
                <Topicos topicos={pagina.topicos} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HelpSheet({ className }: { className?: string }) {
  const pathname = usePathname();
  const [mostrarTudo, setMostrarTudo] = useState(false);
  const paginaAtual = encontrarAjudaDaRota(pathname);

  return (
    <Sheet onOpenChange={(aberto) => !aberto && setMostrarTudo(false)}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Ajuda" className={className} />}>
        <HelpCircle className="size-4" />
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mostrarTudo || !paginaAtual ? "Ajuda" : `Ajuda — ${paginaAtual.titulo}`}</SheetTitle>
          <SheetDescription>
            {mostrarTudo || !paginaAtual ? "O que cada tela faz e como usar." : "O que essa tela faz e como usar."}
          </SheetDescription>
        </SheetHeader>

        {mostrarTudo || !paginaAtual ? (
          <ListaCompleta />
        ) : (
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div>
              <p className="text-sm font-medium text-foreground">{paginaAtual.titulo}</p>
              <p className="mt-2 text-sm text-muted-foreground">{paginaAtual.resumo}</p>
              <p className="mt-2 text-sm text-muted-foreground/70">{paginaAtual.comoUsar}</p>
              <Topicos topicos={paginaAtual.topicos} />
            </div>
            <button
              type="button"
              onClick={() => setMostrarTudo(true)}
              className="self-start text-xs text-gold underline underline-offset-4"
            >
              Ver ajuda de todas as páginas
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
