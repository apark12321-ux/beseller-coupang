import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";

export const runtime = "nodejs";

// 전체 초기화: 업로드/상품 데이터 삭제. 시스템 상태(쿨다운/GET테스트)는 유지.
export async function POST() {
  try {
    const removed = await mutate((db) => {
      const n = db.products.length;
      db.products = [];
      db.uploads = [];
      return n;
    });
    return NextResponse.json({ ok: true, removed });
  } catch (e: any) {
    if (e?.code === "STORAGE_NOT_WRITABLE") {
      return NextResponse.json({ error: e.message, code: "STORAGE_NOT_WRITABLE" }, { status: 503 });
    }
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
