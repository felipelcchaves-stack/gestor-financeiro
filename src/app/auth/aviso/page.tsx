import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { lerConfigAuth, ROTAS_AUTH } from "@/lib/auth/config";
import { AVISOS, motivoValido } from "@/lib/auth/mensagens";

export const dynamic = "force-dynamic";

/** /auth/aviso?motivo=... — por que a entrada pelo Hub não aconteceu. Nunca volta sozinha para o Hub. */
export default async function AvisoPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  const m = motivoValido(motivo);
  const aviso = AVISOS[m];
  const cfg = lerConfigAuth();
  // O plano B só aparece aqui quando o Hub falhou (ou o SSO está desligado) E a emergência foi ligada no .env.
  const mostrarEmergencia = !!cfg.emergencia && (m === "falha" || m === "nao_configurado" || !cfg.hub);

  return (
    <Card>
      <CardHeader>
        <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <CircleAlert className="size-5" aria-hidden />
        </span>
        <CardTitle className="text-xl font-black tracking-tight">{aviso.titulo}</CardTitle>
        <CardDescription className="text-base">{aviso.texto}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {aviso.tentarDeNovo && cfg.hub && (
          <Link href={ROTAS_AUTH.iniciar} className={buttonVariants()}>
            Tentar de novo
          </Link>
        )}
        {mostrarEmergencia && (
          <Link href={ROTAS_AUTH.emergencia} className={buttonVariants({ variant: "outline" })}>
            Acesso de emergência
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
