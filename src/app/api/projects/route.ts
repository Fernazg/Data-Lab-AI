import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getOffice } from "@/lib/server/office";
import { jsonError, readJson, requireAdmin } from "@/lib/server/http";

export const runtime = "nodejs";

/** El cliente envía una solicitud: el CEO la recibe y planifica. */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!config.anthropicConfigured) {
    return jsonError(503, "Los agentes no están configurados: define ANTHROPIC_API_KEY en el servidor.");
  }
  const body = await readJson<{ request?: unknown; title?: unknown }>(request);
  if (!body || typeof body.request !== "string") return jsonError(400, "Falta el campo 'request'.");
  if (body.request.length > 8000) return jsonError(400, "La solicitud es demasiado larga (máx. 8000 caracteres).");
  const { orchestrator, ready } = getOffice();
  await ready;
  try {
    const project = orchestrator.submit(body.request, typeof body.title === "string" ? body.title.slice(0, 120) : undefined);
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "Solicitud inválida");
  }
}
