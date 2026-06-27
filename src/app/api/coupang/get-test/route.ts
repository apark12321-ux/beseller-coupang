import { NextRequest, NextResponse } from "next/server";
import { mutateMeta } from "@/lib/db";
import { getSellerProducts, getCategoryMeta } from "@/lib/coupang/client";
import { credentialStatus } from "@/lib/coupang/hmac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nextAction(sample: any): string {
  if (sample?.ok) return "GET 성공. 쿠팡 키·Vendor ID·IP·HMAC 기본 연동이 정상입니다. 기존 403 쿨다운도 해제했습니다.";
  if (sample?.errorClass === "COUPANG_GATEWAY_ACCESS_DENIED") {
    if (sample?.rejectedIp) return `쿠팡 WING OPEN API의 IP 주소에 ${sample.rejectedIp} 를 추가 등록한 뒤 1~5분 후 다시 GET 테스트를 실행하세요.`;
    return "쿠팡 WING OPEN API 화면의 IP 주소와 실제 호출 IP가 다릅니다. 결과에 표시된 IP를 추가 등록한 뒤 다시 실행하세요.";
  }
  if (sample?.httpStatus === 401 || sample?.httpStatus === 400) return "Access Key, Secret Key, Vendor ID가 같은 업체코드에서 발급된 값인지 확인하세요.";
  return "GET 테스트 결과의 httpStatus와 summary를 확인하세요.";
}

function resultSummary(sample: any) {
  return {
    httpStatus: sample?.httpStatus ?? null,
    errorClass: sample?.errorClass ?? null,
    akamaiReference: sample?.akamaiReference ?? null,
    rejectedIp: sample?.rejectedIp ?? null,
    summary: sample?.summary ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
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
    const ok = !!sample.ok;

    await mutateMeta((m) => {
      m.system.lastGetTestOk = ok;
      m.system.lastGetTestAt = new Date().toISOString();
      if (ok) m.system.cooldownUntil = null;
    }).catch(() => undefined);

    return NextResponse.json({
      ok,
      credentialStatus: cred,
      sellerProducts: resultSummary(sample),
      categoryMeta: meta ? resultSummary(meta) : null,
      cooldownCleared: ok,
      nextAction: nextAction(sample),
      note: ok ? "GET 성공 → Access/Secret/Vendor/IP/HMAC 유효 가능성 높음. 기존 403 쿨다운 해제." : "GET 실패 → 키/IP/HMAC/릴레이 점검 필요.",
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: "GET_TEST_ROUTE_EXCEPTION",
      message: String(e?.message ?? e),
      nextAction: "node server.js와 cloudflared 터널이 모두 켜져 있는지, 그리고 Vercel의 COUPANG_RELAY_URL이 현재 trycloudflare 주소와 일치하는지 확인하세요.",
    }, { status: 200 });
  }
}
