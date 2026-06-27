import { NextRequest, NextResponse } from "next/server";
import { getProduct, getMeta, mutateMeta, mutateProduct } from "@/lib/db";
import { resolveCategory } from "@/lib/pipeline/category";
import { precheck } from "@/lib/coupang/precheck";
import { buildPayload } from "@/lib/coupang/payload";
import { createSellerProduct } from "@/lib/coupang/client";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const confirmed = body?.confirmed === true;

    const meta = await getMeta();
    const p = await getProduct(params.id);
    if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

    // GET 테스트가 다시 성공한 상태라면 과거 403 쿨다운은 해제하고 단건 테스트를 허용한다.
    const cooldownActive = meta.system.cooldownUntil && new Date(meta.system.cooldownUntil) > new Date();
    if (cooldownActive && !meta.system.lastGetTestOk) {
      return NextResponse.json({ blocked: true, reason: "COOLDOWN", cooldownUntil: meta.system.cooldownUntil,
        message: "쿨다운 중. OPEN API에서 GET 테스트를 다시 성공시킨 뒤 재시도하세요." }, { status: 200 });
    }
    if (cooldownActive && meta.system.lastGetTestOk) {
      await mutateMeta((m) => { m.system.cooldownUntil = null; });
    }

    if (!meta.system.lastGetTestOk) {
      return NextResponse.json({ blocked: true, reason: "NO_GET_TEST", message: "GET 테스트 성공 후에만 가능" }, { status: 200 });
    }

    const resolved = resolveCategory(p, meta.catmap);
    const check = precheck(p, resolved.displayCategoryCode);
    if (check.blocked) {
      return NextResponse.json({ blocked: true, reason: "LOCAL_PRECHECK_BLOCKED", errorClass: "LOCAL_PRECHECK_BLOCKED",
        precheck: check, message: "로컬 pre-check 차단 (쿠팡 호출 안 함)" }, { status: 200 });
    }
    if (!p.dryRunOk) {
      return NextResponse.json({ blocked: true, reason: "DRY_RUN_REQUIRED", message: "Dry Run 통과 후에만 가능" }, { status: 200 });
    }
    if (!confirmed) {
      return NextResponse.json({ blocked: true, reason: "CONFIRM_REQUIRED", message: "confirmed=true 필요" }, { status: 200 });
    }

    const payload = buildPayload(p, false, resolved.displayCategoryCode);
    const result = await createSellerProduct(payload);

    if (result.errorClass === "COUPANG_GATEWAY_ACCESS_DENIED") {
      await mutateMeta((m) => { m.system.cooldownUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); });
    }
    await mutateProduct(params.id, (t) => {
      t.lastErrorClass = result.errorClass;
      t.lastResultSummary = result.summary;
      if (result.ok || result.errorClass === "COUPANG_CREATED_SUCCESS" || result.errorClass === "COUPANG_CREATED_WITH_ERRORS") t.status = "draft_saved";
      else t.status = "register_failed";
    });

    return NextResponse.json({
      ok: result.ok,
      blocked: false,
      httpStatus: result.httpStatus,
      errorClass: result.errorClass,
      akamaiReference: result.akamaiReference,
      rejectedIp: result.rejectedIp,
      summary: result.summary,
      json: result.json,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      blocked: true,
      reason: "PRODUCT_POST_ROUTE_EXCEPTION",
      message: String(e?.message ?? e),
    }, { status: 200 });
  }
}
