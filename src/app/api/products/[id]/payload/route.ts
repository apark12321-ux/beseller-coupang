import { NextResponse } from "next/server";
import { getProduct } from "@/lib/db";
import { buildPayload } from "@/lib/coupang/payload";
import { scrub } from "@/lib/mask";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const p = await getProduct(params.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  const payload = buildPayload(p, false);
  return NextResponse.json({ payload: scrub(payload) });
}
