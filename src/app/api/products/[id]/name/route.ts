import { NextRequest, NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { MAX_NAME_LEN } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { finalName } = await req.json();
  if (!finalName || typeof finalName !== "string") {
    return NextResponse.json({ error: "finalName 필요" }, { status: 400 });
  }
  if (finalName.length > MAX_NAME_LEN) {
    return NextResponse.json({ error: `상품명 ${MAX_NAME_LEN}자 초과` }, { status: 400 });
  }
  const product = await mutate((db) => {
    const p = db.products.find((x) => x.id === params.id);
    if (!p) return null;
    p.finalName = finalName;
    p.nameSource = "user";
    if (!p.userEditedFields.includes("finalName")) p.userEditedFields.push("finalName");
    p.updatedAt = new Date().toISOString();
    return p;
  });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ product });
}
