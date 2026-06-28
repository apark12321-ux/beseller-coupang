import { NextRequest, NextResponse } from "next/server";
import { callCoupang } from "@/lib/coupang/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function collectMessages(value: unknown, path = "root", out: Array<{ path: string; value: string }> = []) {
  if (value == null) return out;
  if (typeof value === "string") {
    const s = value.trim();
    if (/반려|거절|reject|denied|error|오류|승인|status|상태|comment|reason|사유/i.test(s)) out.push({ path, value: s });
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean") return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectMessages(v, `${path}[${i}]`, out));
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/reject|denied|error|status|state|reason|comment|approval|message|반려|사유|상태|승인/i.test(k)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out.push({ path: `${path}.${k}`, value: String(v) });
      }
      collectMessages(v, `${path}.${k}`, out);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({
      ok: false,
      error: "MISSING_ID",
      message: "등록상품 ID를 ?id= 뒤에 붙여 주세요. 예: /api/coupang/product-status?id=16278437189",
    }, { status: 400 });
  }

  const result = await callCoupang("GET", `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${encodeURIComponent(id)}`);
  return NextResponse.json({
    ok: result.ok,
    diagnostic: "product-status",
    sellerProductId: id,
    summary: result.summary,
    httpStatus: result.httpStatus,
    errorClass: result.errorClass,
    likelyMessages: collectMessages(result.json).slice(0, 80),
    result,
  });
}
