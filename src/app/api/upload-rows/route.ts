import { NextRequest, NextResponse } from "next/server";
import { mapDataRows } from "@/lib/pipeline/csv";
import { buildProduct } from "@/lib/pipeline/build";
import { appendProducts, mutateMeta, getMeta } from "@/lib/db";
import { Upload } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// 배치 업로드(클라이언트가 파싱 후 행을 나눠 전송).
// body: { uploadId, filename, header: string[], rows: string[][], batchIndex, rowOffset, totalRows }
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { uploadId, filename, header, rows, batchIndex = 0, rowOffset = 0, totalRows = 0 } = body || {};
  if (!uploadId || !Array.isArray(header) || !Array.isArray(rows)) {
    return NextResponse.json({ error: "uploadId/header/rows 필요" }, { status: 400 });
  }

  const meta = await getMeta();
  const mapped = mapDataRows(header, rows);
  const products = mapped.map((r, i) => buildProduct(r, uploadId, rowOffset + i + 1, meta.settings));

  try {
    if (batchIndex === 0) {
      const upload: Upload = { id: uploadId, filename: String(filename || "upload.csv"), rowCount: Number(totalRows) || products.length, createdAt: new Date().toISOString() };
      await mutateMeta((m) => { m.uploads = m.uploads.filter((u) => u.id !== uploadId); m.uploads.push(upload); });
    }
    await appendProducts(products);
  } catch (e: any) {
    if (e?.code === "STORAGE_NOT_WRITABLE") return NextResponse.json({ error: e.message, code: "STORAGE_NOT_WRITABLE" }, { status: 503 });
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }

  const counts = products.reduce<Record<string, number>>((a, p) => { a[p.status] = (a[p.status] ?? 0) + 1; return a; }, {});
  return NextResponse.json({ ok: true, added: products.length, counts });
}
