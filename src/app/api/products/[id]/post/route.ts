import { NextRequest, NextResponse } from "next/server";
import { getProduct, mutate, readDB } from "@/lib/db";
import { precheck } from "@/lib/coupang/precheck";
import { buildPayload } from "@/lib/coupang/payload";
import { createSellerProduct } from "@/lib/coupang/client";

export const runtime = "nodejs";

// 실제 POST. 마지막 단계 전용. 모든 안전장치를 서버에서 강제한다.
// requested=false(임시저장) 만 허용. 한 번 클릭 후 반복 방지는 클라이언트+여기서 dryRun 재검으로 보강.

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const confirmed = body?.confirmed === true;

  const db = await readDB();
  const p = await getProduct(params.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 게이트 1: 쿨다운(403 후 24h)
  if (db.system.cooldownUntil && new Date(db.system.cooldownUntil) > new Date()) {
    return NextResponse.json(
      { blocked: true, reason: "COOLDOWN", cooldownUntil: db.system.cooldownUntil,
        message: "쿨다운 중. 실제 POST 차단. GET/Dry Run/리포트는 가능." },
      { status: 423 }
    );
  }

  // 게이트 2: GET 테스트 성공 선행
  if (!db.system.lastGetTestOk) {
    return NextResponse.json(
      { blocked: true, reason: "NO_GET_TEST", message: "GET 테스트 성공 후에만 가능" },
      { status: 412 }
    );
  }

  // 게이트 3: Dry Run 통과(로컬 pre-check)
  const check = precheck(p);
  if (check.blocked) {
    return NextResponse.json(
      { blocked: true, reason: "LOCAL_PRECHECK_BLOCKED", errorClass: "LOCAL_PRECHECK_BLOCKED",
        precheck: check, message: "로컬 pre-check 차단 (쿠팡 호출 안 함)" },
      { status: 422 }
    );
  }
  if (!p.dryRunOk) {
    return NextResponse.json(
      { blocked: true, reason: "DRY_RUN_REQUIRED", message: "Dry Run 통과 후에만 가능" },
      { status: 412 }
    );
  }

  // 게이트 4: 사용자 확인
  if (!confirmed) {
    return NextResponse.json(
      { blocked: true, reason: "CONFIRM_REQUIRED", message: "confirmed=true 필요" },
      { status: 428 }
    );
  }

  // ── 실제 호출 (requested=false 강제) ──────────────────────────────────────
  const payload = buildPayload(p, false);
  const result = await createSellerProduct(payload);

  // 게이트웨이 403 → 24h 쿨다운 설정
  await mutate((dbw) => {
    if (result.errorClass === "COUPANG_GATEWAY_ACCESS_DENIED") {
      const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      dbw.system.cooldownUntil = until;
    }
    const t = dbw.products.find((x) => x.id === params.id);
    if (t) {
      t.lastErrorClass = result.errorClass;
      t.lastResultSummary = result.summary;
      if (result.errorClass === "COUPANG_CREATED_SUCCESS") t.status = "draft_saved";
      else if (result.errorClass === "COUPANG_CREATED_WITH_ERRORS") t.status = "draft_saved";
      else if (!result.ok) t.status = "register_failed";
      t.updatedAt = new Date().toISOString();
    }
  });

  return NextResponse.json({
    ok: result.ok,
    httpStatus: result.httpStatus,
    errorClass: result.errorClass,
    akamaiReference: result.akamaiReference,
    summary: result.summary,
    json: result.json, // 민감정보 없음(쿠팡 응답)
  });
}
