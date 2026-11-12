import path from "node:path";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getOffice } from "@/lib/server/office";
import { jsonError } from "@/lib/server/http";
import { listWorkspace, readWorkspaceFile } from "@/lib/orchestrator/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Entregables reales del proyecto: lista de archivos o contenido de uno (solo lectura). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { store, ready } = getOffice();
  await ready;
  if (!store.getProject(id)) return jsonError(404, "Proyecto no encontrado");
  const dir = path.join(config.workspaceRoot, id);
  const file = new URL(request.url).searchParams.get("path");
  try {
    if (file) return NextResponse.json({ path: file, content: await readWorkspaceFile(dir, file) });
    return NextResponse.json({ files: await listWorkspace(dir) });
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "No se pudo leer");
  }
}
