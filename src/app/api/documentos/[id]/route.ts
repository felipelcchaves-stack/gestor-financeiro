import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { obterSessaoAtual } from "@/lib/auth/atual";

const TIPOS_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Documentos são extratos e contratos: sem sessão, nada (o proxy.ts já barra; isto é a 2ª camada).
  if (!(await obterSessaoAtual())) return new Response("Entre pelo Hub para ver este documento.", { status: 401 });
  const { id } = await params;
  const documento = await prisma.documento.findUnique({ where: { id } });
  if (!documento) return new Response("Documento não encontrado.", { status: 404 });

  const caminhoAbsoluto = path.join(process.cwd(), documento.caminhoArquivo);
  const conteudo = await readFile(caminhoAbsoluto);
  const extensao = path.extname(documento.caminhoArquivo).toLowerCase();

  return new Response(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": TIPOS_MIME[extensao] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${documento.nomeArquivo}"`,
    },
  });
}
