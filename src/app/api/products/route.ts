import { NextRequest, NextResponse } from "next/server";
import { listProducts, getMeta } from "@/lib/db";
import { storageMode } from "@/lib/store";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "all";
  const page = Math.max(1, Number(sp.get("page") || "1"));
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") || "50")));

  const { items: products, total, counts } = await listProducts(status, page, pageSize);
  const meta = await getMeta();

  const items = products.map((p) => ({
    id: p.id,
    thumbnail: p.images.representationUrl,
    originalName: p.originalName,
    finalName: p.finalName,
    coupangPath: p.category.coupangPath,
    categoryStatus: p.category.status,
    taxType: p.category.taxType,
    supplyPrice: p.supplyPrice,
    salePrice: p.option.salePrice,
    originalPrice: p.option.originalPrice,
    status: p.status,
    blockReasons: p.blockReasons,
  }));

  return NextResponse.json({ items, counts, total, page, pageSize, system: meta.system, storage: storageMode() });
}
