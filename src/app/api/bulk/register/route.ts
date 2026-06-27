import { NextRequest, NextResponse } from "next/server";
import { listProducts, getMeta, mutateMeta, saveProductsBatch } from "@/lib/db";
import { precheck } from "@/lib/coupang/precheck";
import { buildPayload } from "@/lib/coupang/payload";
import { createSellerProduct } from "@/lib/coupang/client";
import { resolveCategory } from "@/lib/pipeline/category";
export const runtime = "nodejs";
export const maxDuration = 60;

function safeMessage(e: any) {
  return String(e?.message ?? e ?? "unknown error").slice(0, 500);
}

export async function POST(req: NextRequest) {
  try {
    const { limit = 1 } = await req.json().catch(() => ({}));
    const safeLimit = Math.max(1, Math.min(Number(limit) || 1, 10));
    const meta = await getMeta();

    if (meta.system.cooldownUntil && new Date(meta.system.cooldownUntil) > new Date()) {
      return NextResponse.json({ stopped: true, reason: "COOLDOWN", cooldownUntil: meta.system.cooldownUntil, message: "쿠팡 403 발생 후 쿨다운 상태입니다." });
    }
    if (!meta.system.lastGetTestOk) {
      return NextResponse.json({ stopped: true, reason: "NO_GET_TEST", message: "GET 테스트 성공 후 가능" });
    }

    const { items, total } = await listProducts("ready", 1, safeLimit);
    let registered = 0, failed = 0;
    const changed: any[] = [];
    const results: any[] = [];

    for (const p of items) {
      try {
        const resolved = resolveCategory(p, meta.catmap);
        const check = precheck(p, resolved.displayCategoryCode);
        if (check.blocked) {
          p.status = "candidate";
          p.lastErrorClass = "LOCAL_PRECHECK_BLOCKED";
          p.lastResultSummary = check.errors.join(" / ");
          changed.push(p);
          results.push({ id: p.id, name: p.finalName, ok: false, reason: "LOCAL_PRECHECK_BLOCKED", message: p.lastResultSummary });
          continue;
        }

        const payload = buildPayload(p, false, resolved.displayCategoryCode);
        const res = await createSellerProduct(payload);

        if (res.errorClass === "COUPANG_GATEWAY_ACCESS_DENIED") {
          await mutateMeta((m) => { m.system.cooldownUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); });
          if (changed.length) await saveProductsBatch(changed);
          return NextResponse.json({ stopped: true, reason: "COUPANG_GATEWAY_ACCESS_DENIED", registered, failed, akamaiReference: res.akamaiReference, rejectedIp: res.rejectedIp, message: res.summary, results });
        }

        p.lastErrorClass = res.errorClass;
        p.lastResultSummary = res.summary;

        if (res.ok || res.errorClass === "COUPANG_CREATED_SUCCESS" || res.errorClass === "COUPANG_CREATED_WITH_ERRORS") {
          p.status = "draft_saved";
          registered++;
          results.push({ id: p.id, name: p.finalName, ok: true, httpStatus: res.httpStatus, summary: res.summary, data: (res.json as any)?.data ?? null });
        } else {
          p.status = "register_failed";
          failed++;
          results.push({ id: p.id, name: p.finalName, ok: false, httpStatus: res.httpStatus, errorClass: res.errorClass, summary: res.summary, json: res.json });
        }
        changed.push(p);
      } catch (e: any) {
        p.status = "register_failed";
        p.lastErrorClass = "COUPANG_API_JSON_ERROR";
        p.lastResultSummary = `등록 처리 예외: ${safeMessage(e)}`;
        failed++;
        changed.push(p);
        results.push({ id: p.id, name: p.finalName, ok: false, reason: "REGISTER_ITEM_EXCEPTION", message: safeMessage(e) });
      }
    }

    if (changed.length) await saveProductsBatch(changed);
    const remaining = Math.max(0, total - items.length);
    return NextResponse.json({ processed: items.length, remaining, done: items.length === 0, registered, failed, results });
  } catch (e: any) {
    return NextResponse.json({
      stopped: true,
      reason: "REGISTER_ROUTE_EXCEPTION",
      message: safeMessage(e),
      registered: 0,
      failed: 0,
      nextAction: "현재 상품 데이터나 쿠팡 등록 payload 생성 중 예외가 발생했습니다. 이 응답 전문을 캡처해서 확인하세요.",
    }, { status: 200 });
  }
}
