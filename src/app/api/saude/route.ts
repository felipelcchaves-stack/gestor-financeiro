import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/saude — público (fora do login), para o status do Hub ("no ar / fora do ar") e
 * monitoramento. Não revela dado nenhum: só se o app e o banco respondem.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
