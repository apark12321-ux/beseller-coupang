import { NextRequest, NextResponse } from "next/server";
import { mutateMeta } from "@/lib/db";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { code, displayCategoryCode, coupangPath, remove } = await req.json().catch(() => ({}));
  if (!code || typeof code !== "string") return NextResponse.json({ error: "code 필요" }, { status: 400 });
  const catmap = await mutateMeta((m) => {
    if (remove) delete m.catmap[code];
    else m.catmap[code] = { displayCategoryCode: String(displayCategoryCode || "").trim(), coupangPath: String(coupangPath || "").trim() };
    return m.catmap;
  });
  return NextResponse.json({ ok: true, catmap });
}
