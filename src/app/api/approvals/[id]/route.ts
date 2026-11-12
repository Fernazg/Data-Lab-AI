import { NextResponse } from "next/server";
import { getOffice } from "@/lib/server/office";
import { jsonError, readJson, requireAdmin } from "@/lib/server/http";

export const runtime = "nodejs";

/** Una persona aprueba o rechaza una acción importante (plan o comando). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson<{ approved?: unknown; note?: unknown }>(request);
  if (!body || typeof body.approved !== "boolean") return jsonError(400, "Falta el campo booleano 'approved'.");
  const { orchestrator, ready } = getOffice();
  await ready;
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : undefined;
  if (!orchestrator.resolveApproval(id, body.approved, note)) {
    return jsonError(409, "La aprobación no existe o ya fue resuelta.");
  }
  return NextResponse.json({ ok: true });
}
