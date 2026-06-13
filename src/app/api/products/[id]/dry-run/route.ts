import { NextResponse } from "next/server";
import { getProduct, getMeta, mutateProduct } from "@/lib/db";
import { precheck } from "@/lib/coupang/precheck";
import { buildPayload } from "@/lib/coupang/payload";
import { resolveCategory } from "@/lib/pipeline/category";
import { scrub } from "@/lib/mask";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const p = await getProduct(params.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  const meta = await getMeta();
  const resolved = resolveCategory(p, meta.catmap);
  const check = precheck(p, resolved.displayCategoryCode);
  const payload = buildPayload(p, false, resolved.displayCategoryCode);
  await mutateProduct(params.id, (x) => { x.dryRunOk = !check.blocked; });
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
