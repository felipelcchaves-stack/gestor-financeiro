import { prisma } from "@/lib/prisma";
import { WizardCarga } from "./WizardCarga";

export const dynamic = "force-dynamic";

export default async function ComecarPage() {
  const passivosExistentes = await prisma.passivo.findMany({
    where: { status: "ATIVO" },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <WizardCarga passivosIniciais={passivosExistentes.map((p) => ({ id: p.id, nome: p.nome }))} />
    </div>
  );
}
