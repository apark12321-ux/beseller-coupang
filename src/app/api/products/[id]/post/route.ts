import { NextRequest, NextResponse } from "next/server";
import { getProduct, getMeta, mutateMeta, mutateProduct } from "@/lib/db";
import { resolveCategory } from "@/lib/pipeline/category";
import { precheck } from "@/lib/coupang/precheck";
import { buildPayload } from "@/lib/coupang/payload";
import { createSellerProduct } from "@/lib/coupang/client";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const confirmed = body?.confirmed === true;

  const meta = await getMeta();
  const p = await getProduct(params.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 게이트 1: 쿨다운
  if (meta.system.cooldownUntil && new Date(meta.system.cooldownUntil) > new Date()) {
    return NextResponse.json({ blocked: true, reason: "COOLDOWN", cooldownUntil: meta.system.cooldownUntil,
      message: "쿨다운 중. 실제 POST 차단. GET/Dry Run/리포트는 가능." }, { status: 423 });
  }
  // 게이트 2: GET 테스트 성공
  if (!meta.system.lastGetTestOk) {
    return NextResponse.json({ blocked: true, reason: "NO_GET_TEST", message: "GET 테스트 성공 후에만 가능" }, { status: 412 });
  }
  // 게이트 3: pre-check + Dry Run
  const resolved = resolveCategory(p, meta.catmap);
  const check = precheck(p, resolved.displayCategoryCode);
  if (check.blocked) {
    return NextResponse.json({ blocked: true, reason: "LOCAL_PRECHECK_BLOCKED", errorClass: "LOCAL_PRECHECK_BLOCKED",
      precheck: check, message: "로컬 pre-check 차단 (쿠팡 호출 안 함)" }, { status: 422 });
  }
  if (!p.dryRunOk) {
    return NextResponse.json({ blocked: true, reason: "DRY_RUN_REQUIRED", message: "Dry Run 통과 후에만 가능" }, { status: 412 });
  }
  // 게이트 4: 확인
  if (!confirmed) {
    return NextResponse.json({ blocked: true, reason: "CONFIRM_REQUIRED", message: "confirmed=true 필요" }, { status: 428 });
  }

  // 실제 호출 (requested=false 강제)
  const payload = buildPayload(p, false, resolved.displayCategoryCode);
  const result = await createSellerProduct(payload);

  if (result.errorClass === "COUPANG_GATEWAY_ACCESS_DENIED") {
    await mutateMeta((m) => { m.system.cooldownUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); });
  }
  await mutateProduct(params.id, (t) => {
    t.lastErrorClass = result.errorClass;
    t.lastResultSummary = result.summary;
    if (result.errorClass === "COUPANG_CREATED_SUCCESS" || result.errorClass === "COUPANG_CREATED_WITH_ERRORS") t.status = "draft_saved";
    else if (!result.ok) t.status = "register_failed";
  });

  return NextResponse.json({
    ok: result.ok, httpStatus: result.httpStatus, errorClass: result.errorClass,
    akamaiReference: result.akamaiReference, summary: result.summary, json: result.json,
  });
}
