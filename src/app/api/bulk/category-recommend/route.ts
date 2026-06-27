import { NextRequest, NextResponse } from "next/server";
import { listProducts, getMeta, saveProductsBatch } from "@/lib/db";
import { predictCategory } from "@/lib/coupang/client";
import { credentialStatus } from "@/lib/coupang/hmac";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { offset = 0, limit = 3 } = await req.json().catch(() => ({}));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 3, 5));
  const cred = credentialStatus();
  if (!cred.accessKeySet || !cred.secretKeySet || !cred.vendorIdSet) {
    return NextResponse.json({ stopped: true, reason: "NO_KEY", message: "쿠팡 키 또는 Vendor ID 미설정" }, { status: 400 });
  }

  const meta = await getMeta();
  const page = Math.floor(offset / safeLimit) + 1;
  const { items, total } = await listProducts("all", page, safeLimit);
  let recommended = 0;
  const changed: any[] = [];

  for (const p of items) {
    if (p.status === "excluded") continue;
    if (p.category.displayCategoryCode || meta.catmap[p.beSellerCode]?.displayCategoryCode) continue;

    let res;
    try {
      res = await predictCategory(p.finalName);
    } catch (e: any) {
      if (changed.length) await saveProductsBatch(changed);
      return NextResponse.json({ stopped: true, reason: "CATEGORY_PREDICT_EXCEPTION", recommended, message: String(e?.message ?? e) });
    }

    if (!res.ok) {
      if (changed.length) await saveProductsBatch(changed);
      return NextResponse.json({ stopped: true, reason: res.errorClass || "CATEGORY_PREDICT_FAILED", recommended, httpStatus: res.httpStatus, message: res.summary, rejectedIp: res.rejectedIp, akamaiReference: res.akamaiReference });
    }

    const pid = (res.json as any)?.data?.predictedCategoryId;
    if (pid) {
      p.category.displayCategoryCode = String(pid);
      const name = (res.json as any)?.data?.predictedCategoryName;
      if (name) p.category.coupangPath = String(name);
      p.category.status = "matched";
      recommended++;
      changed.push(p);
    }
  }

  if (changed.length) await saveProductsBatch(changed);
  const nextOffset = offset + items.length;
  return NextResponse.json({ processed: items.length, nextOffset, total, done: nextOffset >= total, recommended });
}
