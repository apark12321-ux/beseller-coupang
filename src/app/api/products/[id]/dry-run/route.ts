import { NextResponse } from "next/server";
import { getProduct, mutate } from "@/lib/db";
import { precheck } from "@/lib/coupang/precheck";
import { buildPayload } from "@/lib/coupang/payload";
import { scrub } from "@/lib/mask";

export const runtime = "nodejs";

// Dry Run: 실제 쿠팡 호출 없음. payload 생성 + 로컬 pre-check 만.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const p = await getProduct(params.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  const check = precheck(p);
  const payload = buildPayload(p, false);

  await mutate((db) => {
    const t = db.products.find((x) => x.id === params.id);
    if (t) { t.dryRunOk = !check.blocked; t.updatedAt = new Date().toISOString(); }
  });

  return NextResponse.json({
    dryRunOk: !check.blocked,
    errorClass: check.blocked ? "LOCAL_PRECHECK_BLOCKED" : null,
    precheck: check,
    requestSummary: {
      displayCategoryCode: payload.displayCategoryCode,
      sellerProductName: payload.sellerProductName,
      itemName: payload.items[0]?.itemName,
      salePrice: payload.items[0]?.salePrice,
      originalPrice: payload.items[0]?.originalPrice,
      attributes: payload.items[0]?.attributes,
      contentsCount: payload.items[0]?.contents?.[0]?.contentDetails?.length ?? 0,
      taxType: payload.items[0]?.taxType,
    },
    payload: scrub(payload),
  });
}
