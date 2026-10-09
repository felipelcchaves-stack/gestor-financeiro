import Link from "next/link";
import { LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ROTAS_AUTH } from "@/lib/auth/config";

/**
 * /auth/saiu — para onde o Hub manda depois do "Sair" (post_logout_redirect_uri). Pública e
 * parada de propósito: se voltasse para "/", a sessão do Hub (que continua aberta) faria a pessoa
 * entrar de novo na hora.
 */
export default function SaiuPage() {
  return (
    <Card>
      <CardHeader>
        <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <LogOut className="size-5" aria-hidden />
        </span>
        <CardTitle className="text-xl font-black tracking-tight">Você saiu do Gestor Financeiro</CardTitle>
        <CardDescription className="text-base">Para entrar de novo, use o Hub. Ele pede a senha e o código só lá.</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={ROTAS_AUTH.iniciar} className={buttonVariants()}>
          Entrar pelo Hub
        </Link>
      </CardContent>
    </Card>
  );
}
