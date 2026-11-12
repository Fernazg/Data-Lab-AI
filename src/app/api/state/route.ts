import { NextResponse } from "next/server";
import { getOffice, systemInfo } from "@/lib/server/office";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { store, ready } = getOffice();
  await ready;
  return NextResponse.json(store.snapshot(systemInfo(store)));
}
