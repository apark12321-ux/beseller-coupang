import { NextRequest, NextResponse } from "next/server";
import { listProducts, getMeta, saveProductsBatch } from "@/lib/db";
import { precheck } from "@/lib/coupang/precheck";
import { resolveCategory } from "@/lib/pipeline/category";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { offset = 0, limit = 300 } = await req.json().catch(() => ({}));
  const meta = await getMeta();
  const page = Math.floor(offset / limit) + 1;
  const { items, total } = await listProducts("all", page, limit);
  let ready = 0, blocked = 0;
  const changed: any[] = [];
  for (const p of items) {
    if (p.status === "excluded") continue;
    const resolved = resolveCategory(p, meta.catmap);
    const check = precheck(p, resolved.displayCategoryCode);
    p.dryRunOk = !check.blocked;
    const next = check.blocked ? "candidate" : "ready";
    if (p.status === "candidate" || p.status === "ready") {
      if (p.status !== next) { p.status = next as any; }
      check.blocked ? blocked++ : ready++;
      changed.push(p);
    }
  }
  if (changed.length) await saveProductsBatch(changed);
  const nextOffset = offset + items.length;
  return NextResponse.json({ processed: items.length, nextOffset, total, done: nextOffset >= total, ready, blocked });
}
