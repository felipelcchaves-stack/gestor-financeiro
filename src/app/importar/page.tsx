import Link from "next/link";
import { Receipt, CreditCard, Camera } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import type { ComponentType } from "react";

export default function ImportarIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Dados" title="Importar" description="Escolha o que você quer trazer pro sistema." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardImportar
          icon={Receipt}
          href="/importar/extrato"
          titulo="Extrato bancário"
          descricao="PDF do extrato da conta — lançamentos, um por um, classificados na hora."
        />
        <CardImportar
          icon={CreditCard}
          href="/importar/fatura"
          titulo="Fatura de cartão"
          descricao="PDF da fatura — total, mínimo e vencimento, com melhor palpite automático."
        />
        <CardImportar
          icon={Camera}
          href="/importar/imagem"
          titulo="Print / imagem"
          descricao="Screenshot do app do banco — você digita o que vê, sem leitura automática."
        />
      </div>
    </div>
  );
}

function CardImportar({
  icon: Icon,
  href,
  titulo,
  descricao,
}: {
  icon: ComponentType<{ className?: string }>;
  href: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link href={href} className="glass-card rounded-2xl p-4 transition-colors hover:border-gold/40">
      <span className="flex size-8 items-center justify-center rounded-lg bg-gold/10 text-gold">
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">{titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
    </Link>
  );
}
