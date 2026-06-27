import { NextResponse } from "next/server";
import { createSellerProduct } from "@/lib/coupang/client";
import { env } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await createSellerProduct({ vendorId: env.vendorId, diagnostic: true });
  const gatewayReached = result.httpStatus !== 403 || result.errorClass !== "COUPANG_GATEWAY_ACCESS_DENIED";

  return NextResponse.json({
    ok: gatewayReached,
    diagnostic: true,
    purpose: "상품 생성 POST 엔드포인트가 게이트웨이를 통과하는지 확인하는 진단입니다. 의도적으로 불완전한 payload를 보내므로 정상이라면 상품 생성이 아니라 JSON 검증 오류가 나와야 합니다.",
    interpretation: gatewayReached
      ? "POST 게이트웨이는 통과했습니다. 실제 상품 payload 값 또는 필수 필드 검증 문제를 봐야 합니다."
      : "POST 게이트웨이에서 차단됐습니다. GET은 성공하지만 상품 생성 POST 엔드포인트가 계정/연동업체/IP 정책에서 차단되는 상태입니다.",
    result,
  });
}

export async function GET() {
  return POST();
}
