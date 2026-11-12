import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "../config";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Si hay ADMIN_TOKEN configurado, exige la cabecera `x-admin-token` en las acciones. */
export function requireAdmin(request: Request): NextResponse | null {
  const expected = config.adminToken;
  if (!expected) return null;
  const given = request.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return jsonError(401, "Token de administración inválido");
  return null;
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
