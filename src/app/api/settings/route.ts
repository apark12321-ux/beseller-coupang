import { NextRequest, NextResponse } from "next/server";
import { getMeta, mutateMeta } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { Settings } from "@/lib/types";
export const runtime = "nodejs";

export async function GET() {
  const meta = await getMeta();
  return NextResponse.json({ settings: meta.settings });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<Settings>;
  const next = await mutateMeta((m) => {
    const s = m.settings ?? { ...DEFAULT_SETTINGS };
    if (body.priceMode === "supply" || body.priceMode === "sale") s.priceMode = body.priceMode;
    if (typeof body.feeRate === "number" && body.feeRate >= 0 && body.feeRate < 1) s.feeRate = body.feeRate;
    if (typeof body.margin === "number" && body.margin >= 0 && body.margin < 1) s.margin = body.margin;
    if (typeof body.originalMultiplier === "number" && body.originalMultiplier >= 1) s.originalMultiplier = body.originalMultiplier;
    if (typeof body.imageBaseUrl === "string") s.imageBaseUrl = body.imageBaseUrl.trim();
    m.settings = s;
    return s;
  });
  return NextResponse.json({ settings: next });
}
