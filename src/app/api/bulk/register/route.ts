import { NextRequest, NextResponse } from "next/server";
import { listProducts, getMeta, mutateMeta, saveProductsBatch } from "@/lib/db";
import { precheck } from "@/lib/coupang/precheck";
import { buildPayload } from "@/lib/coupang/payload";
import { createSellerProduct } from "@/lib/coupang/client";
import { resolveCategory } from "@/lib/pipeline/category";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { limit = 10 } = await req.json().catch(() => ({}));
  const meta = await getMeta();

  if (meta.system.cooldownUntil && new Date(meta.system.cooldownUntil) > new Date())
    return NextResponse.json({ stopped: true, reason: "COOLDOWN", cooldownUntil: meta.system.cooldownUntil });
  if (!meta.system.lastGetTestOk)
    return NextResponse.json({ stopped: true, reason: "NO_GET_TEST", message: "GET 테스트 성공 후 가능" });

  // 항상 'ready' 1페이지를 소비(등록되면 draft_saved로 빠짐)
  const { items, total } = await listProducts("ready", 1, limit);
  let registered = 0, failed = 0;
  const changed: any[] = [];

  for (const p of items) {
    const resolved = resolveCategory(p, meta.catmap);
    const check = precheck(p, resolved.displayCategoryCode);
    if (check.blocked) { p.status = "candidate"; changed.push(p); continue; }
    const payload = buildPayload(p, false, resolved.displayCategoryCode);
    const res = await createSellerProduct(payload);
    if (res.errorClass === "COUPANG_GATEWAY_ACCESS_DENIED") {
      await mutateMeta((m) => { m.system.cooldownUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); });
      if (changed.length) await saveProductsBatch(changed);
      return NextResponse.json({ stopped: true, reason: "COUPANG_GATEWAY_ACCESS_DENIED", registered, failed, akamaiReference: res.akamaiReference });
    }
    p.lastErrorClass = res.errorClass; p.lastResultSummary = res.summary;
    if (res.errorClass === "COUPANG_CREATED_SUCCESS" || res.errorClass === "COUPANG_CREATED_WITH_ERRORS") { p.status = "draft_saved"; registered++; }
    else { p.status = "register_failed"; failed++; }
    changed.push(p);
  }
  if (changed.length) await saveProductsBatch(changed);
  const remaining = Math.max(0, total - items.length);
  return NextResponse.json({ processed: items.length, remaining, done: items.length === 0, registered, failed });
}
