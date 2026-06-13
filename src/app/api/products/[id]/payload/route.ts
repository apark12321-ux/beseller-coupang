import { NextResponse } from "next/server";
import { getProduct, getMeta } from "@/lib/db";
import { buildPayload } from "@/lib/coupang/payload";
import { resolveCategory } from "@/lib/pipeline/category";
import { scrub } from "@/lib/mask";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const p = await getProduct(params.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  const meta = await getMeta();
  const resolved = resolveCategory(p, meta.catmap);
  const payload = buildPayload(p, false, resolved.displayCategoryCode);
  return NextResponse.json({ payload: scrub(payload) });
}
