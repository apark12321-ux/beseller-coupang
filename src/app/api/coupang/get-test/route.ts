import { NextRequest, NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { getSellerProducts, getCategoryMeta } from "@/lib/coupang/client";
import { credentialStatus } from "@/lib/coupang/hmac";

export const runtime = "nodejs";

// GET 진단. 성공 시 system.lastGetTestOk=true → 실제 POST 게이트 해제 조건 충족.
export async function POST(req: NextRequest) {
  const cred = credentialStatus();
  if (!cred.accessKeySet || !cred.secretKeySet) {
    return NextResponse.json({ error: "API 키 미설정 (.env.local 확인)" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const sample = await getSellerProducts();
  const meta = body?.displayCategoryCode
    ? await getCategoryMeta(String(body.displayCategoryCode))
    : null;

  const ok = sample.ok;
  await mutate((db) => {
    db.system.lastGetTestOk = ok;
    db.system.lastGetTestAt = new Date().toISOString();
  });

  return NextResponse.json({
    ok,
    credentialStatus: cred,
    sellerProducts: { httpStatus: sample.httpStatus, errorClass: sample.errorClass, summary: sample.summary },
    categoryMeta: meta ? { httpStatus: meta.httpStatus, errorClass: meta.errorClass, summary: meta.summary } : null,
    note: ok
      ? "GET 성공 → Access/Secret/Vendor/IP/HMAC 유효 가능성 높음."
      : "GET 실패 → 키/IP/HMAC 점검 필요.",
  });
}
