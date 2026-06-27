import { NextRequest, NextResponse } from "next/server";
import { mutateMeta } from "@/lib/db";
import { getSellerProducts, getCategoryMeta } from "@/lib/coupang/client";
import { credentialStatus } from "@/lib/coupang/hmac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nextAction(sample: any): string {
  if (sample?.ok) return "GET 성공. 쿠팡 키·Vendor ID·IP·HMAC 기본 연동이 정상입니다.";
  if (sample?.errorClass === "COUPANG_GATEWAY_ACCESS_DENIED") {
    return "쿠팡 WING OPEN API 화면의 IP 주소에 현재 표시된 서버 외부 IP를 등록한 뒤 1~5분 후 다시 실행하세요.";
  }
  if (sample?.httpStatus === 401 || sample?.httpStatus === 400) {
    return "Access Key, Secret Key, Vendor ID가 같은 업체코드에서 발급된 값인지 확인하세요.";
  }
  return "GET 테스트 결과의 httpStatus와 summary를 확인하세요.";
}

export async function POST(req: NextRequest) {
  const cred = credentialStatus();
  if (!cred.accessKeySet || !cred.secretKeySet || !cred.vendorIdSet) {
    return NextResponse.json({
      ok: false,
      error: "쿠팡 API 환경변수 미설정",
      credentialStatus: cred,
      required: ["COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY", "COUPANG_VENDOR_ID"],
    }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const sample = await getSellerProducts();
  const meta = body?.displayCategoryCode ? await getCategoryMeta(String(body.displayCategoryCode)) : null;
  const ok = sample.ok;

  await mutateMeta((m) => {
    m.system.lastGetTestOk = ok;
    m.system.lastGetTestAt = new Date().toISOString();
    m.system.lastGetTestSummary = sample.summary;
  });

  return NextResponse.json({
    ok,
    credentialStatus: cred,
    sellerProducts: {
      httpStatus: sample.httpStatus,
      errorClass: sample.errorClass,
      akamaiReference: sample.akamaiReference,
      summary: sample.summary,
    },
    categoryMeta: meta ? {
      httpStatus: meta.httpStatus,
      errorClass: meta.errorClass,
      summary: meta.summary,
    } : null,
    nextAction: nextAction(sample),
    note: ok ? "GET 성공 → Access/Secret/Vendor/IP/HMAC 유효 가능성 높음." : "GET 실패 → 키/IP/HMAC 점검 필요.",
  });
}
