import { NextRequest, NextResponse } from "next/server";
import { mutateProduct } from "@/lib/db";
import { recalcOriginal } from "@/lib/pipeline/price";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { salePrice, originalPrice } = await req.json();
  const { product } = await mutateProduct(params.id, (p) => {
    if (typeof salePrice === "number") {
      p.option.salePrice = salePrice;
      if (!p.userEditedFields.includes("option.salePrice")) p.userEditedFields.push("option.salePrice");
      if (typeof originalPrice !== "number") p.option.originalPrice = recalcOriginal(salePrice).originalPrice;
    }
    if (typeof originalPrice === "number") {
      p.option.originalPrice = originalPrice;
      if (!p.userEditedFields.includes("option.originalPrice")) p.userEditedFields.push("option.originalPrice");
    }
  });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  const warn = product.option.originalPrice <= product.option.salePrice ? "originalPrice ≤ salePrice" : null;
  return NextResponse.json({ product, warning: warn });
}
