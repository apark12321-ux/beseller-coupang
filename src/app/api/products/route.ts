import { NextRequest, NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { storageMode } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const db = await readDB();
  let products = db.products;
  if (status && status !== "all") products = products.filter((p) => p.status === status);
  // 리스트는 요약만
  const items = products.map((p) => ({
    id: p.id,
    thumbnail: p.images.representationUrl,
    originalName: p.originalName,
    finalName: p.finalName,
    optionCount: 1,
    coupangPath: p.category.coupangPath,
    categoryStatus: p.category.status,
    supplyPrice: p.supplyPrice,
    salePrice: p.option.salePrice,
    originalPrice: p.option.originalPrice,
    status: p.status,
    blockReasons: p.blockReasons,
  }));
  const counts = db.products.reduce<Record<string, number>>((a, p) => {
    a[p.status] = (a[p.status] ?? 0) + 1; a.all = (a.all ?? 0) + 1; return a;
  }, {});
  return NextResponse.json({ items, counts, system: db.system, storage: storageMode() });
}
