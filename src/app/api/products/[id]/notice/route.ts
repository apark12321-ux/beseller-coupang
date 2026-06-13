import { NextRequest, NextResponse } from "next/server";
import { mutateProduct } from "@/lib/db";
import { NoticeStatus } from "@/lib/types";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { status, fields } = await req.json();
  const valid: NoticeStatus[] = ["not_started", "not_reviewed", "reviewed", "approved"];
  const { product } = await mutateProduct(params.id, (p) => {
    if (Array.isArray(fields)) for (const f of fields) {
      const t = p.notice.fields.find((x) => x.name === f.name);
      if (t && typeof f.content === "string") t.content = f.content;
    }
    if (typeof status === "string" && valid.includes(status as NoticeStatus)) p.notice.status = status as NoticeStatus;
  });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ product });
}
