import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { parseCsv } from "@/lib/pipeline/csv";
import { buildProduct } from "@/lib/pipeline/build";
import { addUpload } from "@/lib/db";
import { Upload } from "@/lib/types";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file 필요" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const rows = parseCsv(buf);
  if (rows.length === 0) return NextResponse.json({ error: "파싱된 행 없음 (컬럼/인코딩 확인)" }, { status: 400 });

  const uploadId = crypto.randomUUID();
  const products = rows.map((r, i) => buildProduct(r, uploadId, i + 1));
  const upload: Upload = { id: uploadId, filename: file.name, rowCount: rows.length, createdAt: new Date().toISOString() };

  try {
    await addUpload(upload, products);
  } catch (e: any) {
    if (e?.code === "STORAGE_NOT_WRITABLE") return NextResponse.json({ error: e.message, code: "STORAGE_NOT_WRITABLE" }, { status: 503 });
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }

  const counts = products.reduce<Record<string, number>>((a, p) => { a[p.status] = (a[p.status] ?? 0) + 1; return a; }, {});
  return NextResponse.json({ uploadId, rowCount: rows.length, counts });
}
