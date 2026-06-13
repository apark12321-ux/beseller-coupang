import { NextResponse } from "next/server";
import { resetAll } from "@/lib/db";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const removed = await resetAll();
    return NextResponse.json({ ok: true, removed });
  } catch (e: any) {
    if (e?.code === "STORAGE_NOT_WRITABLE") return NextResponse.json({ error: e.message, code: "STORAGE_NOT_WRITABLE" }, { status: 503 });
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
