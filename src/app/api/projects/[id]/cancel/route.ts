import { NextResponse } from "next/server";
import { getOffice } from "@/lib/server/office";
import { jsonError, requireAdmin } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const { orchestrator, ready } = getOffice();
  await ready;
  try {
    orchestrator.cancel(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(409, err instanceof Error ? err.message : "No se pudo cancelar");
  }
}
