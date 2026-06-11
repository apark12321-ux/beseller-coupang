import { NextRequest, NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { recalcOriginal } from "@/lib/pipeline/price";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { salePrice, originalPrice } = await req.json();
  const product = await mutate((db) => {
    const p = db.products.find((x) => x.id === params.id);
    if (!p) return null;
    if (typeof salePrice === "number") {
      p.option.salePrice = salePrice;
      if (!p.userEditedFields.includes("option.salePrice")) p.userEditedFields.push("option.salePrice");
      // 정상가 미지정 시 자동 재계산
      if (typeof originalPrice !== "number") {
        p.option.originalPrice = recalcOriginal(salePrice).originalPrice;
      }
    }
    if (typeof originalPrice === "number") {
      p.option.originalPrice = originalPrice;
      if (!p.userEditedFields.includes("option.originalPrice")) p.userEditedFields.push("option.originalPrice");
    }
    p.updatedAt = new Date().toISOString();
    return p;
  });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  const warn = product.option.originalPrice <= product.option.salePrice ? "originalPrice ≤ salePrice" : null;
  return NextResponse.json({ product, warning: warn });
}
