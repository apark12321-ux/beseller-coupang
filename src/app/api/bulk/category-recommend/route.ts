import { NextRequest, NextResponse } from "next/server";
import { listProducts, getMeta, saveProductsBatch } from "@/lib/db";
import { predictCategory } from "@/lib/coupang/client";
import { credentialStatus } from "@/lib/coupang/hmac";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { offset = 0, limit = 15 } = await req.json().catch(() => ({}));
  const cred = credentialStatus();
  if (!cred.accessKeySet || !cred.secretKeySet) return NextResponse.json({ stopped: true, reason: "NO_KEY", message: "쿠팡 키 미설정" }, { status: 400 });

  const meta = await getMeta();
  const page = Math.floor(offset / limit) + 1;
  const { items, total } = await listProducts("all", page, limit);
  let recommended = 0;
  const changed: any[] = [];
  for (const p of items) {
    if (p.status === "excluded") continue;
    // 이미 개별 지정/매핑된 건 건너뜀
    if (p.category.displayCategoryCode || meta.catmap[p.beSellerCode]?.displayCategoryCode) continue;
    const res = await predictCategory(p.finalName);
    if (res.errorClass === "COUPANG_GATEWAY_ACCESS_DENIED") {
      if (changed.length) await saveProductsBatch(changed);
      return NextResponse.json({ stopped: true, reason: "COUPANG_GATEWAY_ACCESS_DENIED", recommended, akamaiReference: res.akamaiReference, message: "쿠팡 게이트웨이 403 — 등록 IP에서 실행하세요." });
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
