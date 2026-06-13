import { NextResponse } from "next/server";
import { getProduct, getMeta } from "@/lib/db";
import { precheck } from "@/lib/coupang/precheck";
import { resolveCategory } from "@/lib/pipeline/category";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const p = await getProduct(params.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  const meta = await getMeta();
  const resolved = resolveCategory(p, meta.catmap);
  return NextResponse.json({ product: p, precheck: precheck(p, resolved.displayCategoryCode), resolvedCategory: resolved });
}
