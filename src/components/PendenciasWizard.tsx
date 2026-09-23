"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { atualizarSaldoPassivo } from "@/app/passivos/actions";
import { atualizarSaldoConta } from "@/app/contas/actions";
import { definirAporteMensal } from "@/app/(mapa)/actions";
import type { PendenciaWizard } from "@/lib/pendenciasWizard";

// "Adiar" só guarda a decisão nessa aba/sessão do navegador — nunca
// decide se o wizard aparece de novo. Quem decide isso é sempre o dado
// real (src/lib/pendenciasWizard.ts, recalculado do zero a cada
// carregamento): uma sessão nova, ou a mesma pendência ainda existindo
// depois de um refresh completo, faz ele voltar a aparecer.
const CHAVE_ADIADO = "pendencias-wizard-adiado";

function tituloDaPendencia(p: PendenciaWizard): string {
  if (p.tipo === "aporteNaoConfigurado") return "Quanto você consegue direcionar de aporte extra por mês?";
  return `Qual o saldo atual de "${p.nome}"?`;
}

export function PendenciasWizard({ pendencias }: { pendencias: PendenciaWizard[] }) {
  const [restantes, setRestantes] = useState(pendencias);
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (pendencias.length === 0) return;
    let adiado = false;
    try {
      adiado = sessionStorage.getItem(CHAVE_ADIADO) === "1";
    } catch {
      // Aba privada ou storage bloqueado — sem como lembrar "adiado",
      // então só mostra normalmente.
    }
    if (!adiado) setAberto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atual = restantes[0];

  function adiar() {
    setAberto(false);
    try {
      sessionStorage.setItem(CHAVE_ADIADO, "1");
    } catch {
      // Sem storage disponível — só fecha por essa renderização, sem
      // quebrar nada.
    }
  }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!atual) return;
    setSalvando(true);
    setErro(null);
    try {
      const formData = new FormData();
      if (atual.tipo === "passivoSemSaldo") {
        formData.set("valorQuitacao", valor);
        await atualizarSaldoPassivo(atual.passivoId, formData);
      } else if (atual.tipo === "contaSemSaldo") {
        formData.set("saldo", valor);
        await atualizarSaldoConta(atual.contaId, formData);
      } else {
        formData.set("aporte", valor);
        await definirAporteMensal(formData);
      }
      setValor("");
      setRestantes((prev) => {
        const proximas = prev.slice(1);
        if (proximas.length === 0) setAberto(false);
        return proximas;
      });
    } catch {
      // As ações reaproveitadas aqui (atualizarSaldoConta etc.) lançam
      // Error em vez de devolver {ok, erro} — em produção o Next.js
      // apaga a mensagem real de um erro lançado numa Server Action,
      // então o texto aqui é sempre genérico de propósito, nunca tenta
      // mostrar `err.message`.
      setErro("Não consegui salvar — confira o valor (só números) e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (restantes.length === 0 || !atual) return null;

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Pendências pra parametrizar o sistema</SheetTitle>
          <SheetDescription>
            {restantes.length} pendência{restantes.length === 1 ? "" : "s"} — sem isso, alguns cálculos ficam
            incompletos.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={salvar} className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">{tituloDaPendencia(atual)}</label>
            <input
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm text-foreground"
            />
          </div>

          {erro && <p className="text-xs text-debt">{erro}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar e continuar"}
            </Button>
            <Button type="button" variant="ghost" onClick={adiar}>
              Fazer isso depois
            </Button>
          </div>
        </form>

        <SheetFooter>
          <p className="text-[11px] text-muted-foreground/70">
            Isso aparece sozinho sempre que houver dado estrutural faltando ou alguma inconsistência — some assim
            que tudo estiver preenchido.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
