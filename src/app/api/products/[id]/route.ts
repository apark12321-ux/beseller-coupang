import { NextResponse } from "next/server";
import { getProduct } from "@/lib/db";
import { precheck } from "@/lib/coupang/precheck";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const p = await getProduct(params.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ product: p, precheck: precheck(p) });
}
