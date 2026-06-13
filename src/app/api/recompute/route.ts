import { NextRequest, NextResponse } from "next/server";
import { listProducts, getMeta, saveProductsBatch } from "@/lib/db";
import { calcPriceWithSettings } from "@/lib/pipeline/price";
import { buildImageSet } from "@/lib/pipeline/images";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { offset = 0, limit = 300 } = await req.json().catch(() => ({}));
  const meta = await getMeta();
  const s = meta.settings;
  const page = Math.floor(offset / limit) + 1;
  const { items, total } = await listProducts("all", page, limit);

  for (const p of items) {
    // 가격: 사용자가 직접 수정한 필드는 보존
    const price = calcPriceWithSettings(p.supplyPrice, s);
    if (!p.userEditedFields.includes("option.salePrice")) p.option.salePrice = price.salePrice;
    if (!p.userEditedFields.includes("option.originalPrice")) p.option.originalPrice = price.originalPrice;
    // 이미지: 원본 파일명에 현재 베이스 재적용
    if (Array.isArray(p.rawImages) && p.rawImages.length) {
      const imgs = buildImageSet(p.rawImages, s.imageBaseUrl);
      p.images.representationUrl = imgs.representationUrl;
      p.images.detailUrls = imgs.detailUrls;
    }
    p.updatedAt = new Date().toISOString();
  }
  await saveProductsBatch(items);

  const nextOffset = offset + items.length;
  return NextResponse.json({ processed: items.length, nextOffset, total, done: nextOffset >= total });
}
