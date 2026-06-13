import { NextRequest, NextResponse } from "next/server";
import { mutateProduct } from "@/lib/db";
import { checkMismatch } from "@/lib/pipeline/category";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { displayCategoryCode, coupangPath, markValid } = await req.json();
  const { product } = await mutateProduct(params.id, (p) => {
    if (typeof displayCategoryCode === "string") p.category.displayCategoryCode = displayCategoryCode;
    if (typeof coupangPath === "string") p.category.coupangPath = coupangPath;
    if (p.category.coupangPath) {
      const v = checkMismatch(p.originalName, p.category.coupangPath);
      if (v) { p.category.status = "mismatch_warning"; p.category.reason = v; }
      else if (markValid && p.category.displayCategoryCode) { p.category.status = "stored_valid"; p.category.reason = null; }
    }
  });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ product });
}
