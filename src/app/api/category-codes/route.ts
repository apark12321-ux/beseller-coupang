import { NextResponse } from "next/server";
import { aggregateCategoryCodes, getMeta } from "@/lib/db";
import { EXCLUDED_CODES, NEEDS_REVIEW_CODES, INCLUDABLE_CODES } from "@/lib/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABEL = (code: string): string =>
  EXCLUDED_CODES[code] ? `제외:${EXCLUDED_CODES[code]}`
  : NEEDS_REVIEW_CODES[code] ? `검수:${NEEDS_REVIEW_CODES[code]}`
  : INCLUDABLE_CODES[code] ? INCLUDABLE_CODES[code]
  : code.startsWith("C002005") ? "과일류" : "";

export async function GET() {
  const [codes, meta] = await Promise.all([aggregateCategoryCodes(), getMeta()]);
  const items = codes.map((c) => ({
    code: c.code, count: c.count, label: LABEL(c.code),
    mapped: meta.catmap[c.code] ?? null,
  }));
  return NextResponse.json({ items });
}
