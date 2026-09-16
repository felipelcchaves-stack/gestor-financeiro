import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PassivoForm } from "../../PassivoForm";
import { atualizarPassivo } from "../../actions";

export default async function EditarPassivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passivo = await prisma.passivo.findUnique({ where: { id } });
  if (!passivo) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Editar passivo — {passivo.nome}</h1>
      <PassivoForm action={atualizarPassivo.bind(null, id)} passivo={passivo} modoEdicao />
    </div>
  );
}
