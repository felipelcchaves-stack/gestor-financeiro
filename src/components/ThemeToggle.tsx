"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // O tema real só é conhecido depois que o script "beforeInteractive" (em
    // layout.tsx) já rodou no navegador — antes disso, o servidor não tem
    // como saber a preferência salva no localStorage. Só renderiza o ícone
    // certo depois de montar, pra nunca divergir do HTML que o servidor
    // mandou (que sempre assume "escuro" por padrão).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const novoDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", novoDark);
    localStorage.setItem("tema", novoDark ? "dark" : "light");
    setDark(novoDark);
  }

  return (
    <Button variant="ghost" size="icon" onClick={alternar} aria-label="Alternar tema claro/escuro" className={className}>
      {mounted && dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
