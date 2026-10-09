import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lerConfigAuth } from "@/lib/auth/config";
import { entrarEmergencia } from "./actions";

export const dynamic = "force-dynamic";

const ERROS: Record<string, string> = {
  invalido: "Senha ou código errado.",
  bloqueado: "Muitas tentativas. Espere 15 minutos.",
  hub_no_ar: "O Hub está no ar. Entre por ele.",
  sem_dono: "Nenhum dono cadastrado. Rode npm run usuario:criar no servidor.",
};

/**
 * /auth/emergencia — plano B, só existe com GESTOR_LOGIN_EMERGENCIA=true no .env (senão, 404).
 * Não aparece no fluxo normal: só como link na tela de aviso quando o Hub falha.
 */
export default async function EmergenciaPage({ searchParams }: { searchParams: Promise<{ erro?: string; destino?: string }> }) {
  if (!lerConfigAuth().emergencia) notFound();
  const { erro, destino } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <ShieldAlert className="size-5" aria-hidden />
        </span>
        <CardTitle className="text-xl font-black tracking-tight">Acesso de emergência</CardTitle>
        <CardDescription className="text-base">Use só se o Hub estiver fora do ar. Digite a senha de emergência e o código do app autenticador.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={entrarEmergencia} className="space-y-4">
          <input type="hidden" name="destino" value={destino ?? "/"} />
          <div className="space-y-2">
            <Label htmlFor="senha">Senha de emergência</Label>
            <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigo">Código do app (6 números)</Label>
            <Input id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required />
          </div>
          {erro && ERROS[erro] && (
            <p role="alert" className="text-sm font-bold text-destructive">
              {ERROS[erro]}
            </p>
          )}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
