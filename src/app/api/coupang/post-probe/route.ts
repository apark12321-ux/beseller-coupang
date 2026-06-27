import { NextRequest, NextResponse } from "next/server";
import { getProduct, getMeta, listProducts } from "@/lib/db";
import { resolveCategory } from "@/lib/pipeline/category";
import { buildPayload } from "@/lib/coupang/payload";
import { createSellerProduct } from "@/lib/coupang/client";
import { env } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function payloadStats(payload: any) {
  const text = JSON.stringify(payload);
  const item = payload?.items?.[0] ?? {};
  const contents = item?.contents?.[0]?.contentDetails ?? [];
  return {
    bytes: Buffer.byteLength(text, "utf8"),
    chars: text.length,
    itemCount: Array.isArray(payload?.items) ? payload.items.length : 0,
    imageCount: Array.isArray(item?.images) ? item.images.length : 0,
    contentImageCount: Array.isArray(contents) ? contents.length : 0,
    noticeCount: Array.isArray(item?.notices) ? item.notices.length : 0,
    attributeCount: Array.isArray(item?.attributes) ? item.attributes.length : 0,
    displayCategoryCode: payload?.displayCategoryCode ?? null,
  };
}

function maskPayloadForInvalidCategory(payload: any) {
  const p = clone(payload);
  p.displayCategoryCode = "0";
  p.sellerProductName = "POST 진단용 상품명";
  p.displayProductName = "POST 진단용 상품명";
  p.requested = false;
  return p;
}

function removeImages(payload: any) {
  const p = clone(payload);
  if (Array.isArray(p.items) && p.items[0]) {
    p.items[0].images = [];
    p.items[0].contents = [{ contentsType: "TEXT", contentDetails: [{ content: "POST 진단용 상세설명", detailType: "TEXT" }] }];
  }
  return p;
}

async function pickProduct(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) return getProduct(id);
  const ready = await listProducts("ready", 1, 1);
  if (ready.items[0]) return ready.items[0];
  const candidate = await listProducts("candidate", 1, 1);
  return candidate.items[0] ?? null;
}

export async function GET(req: NextRequest) {
  const meta = await getMeta();
  const product = await pickProduct(req);
  if (!product) return NextResponse.json({ ok: false, error: "NO_PRODUCT", message: "진단할 상품이 없습니다." });

  const resolved = resolveCategory(product, meta.catmap);
  const actualPayload = buildPayload(product, false, resolved.displayCategoryCode);

  const minimalInvalid = {
    vendorId: env.vendorId,
    displayCategoryCode: "0",
    sellerProductName: "POST 진단용 상품명",
    displayProductName: "POST 진단용 상품명",
    requested: false,
    items: [],
  };

  const actualInvalidCategory = maskPayloadForInvalidCategory(actualPayload);
  const actualNoImagesInvalidCategory = removeImages(actualInvalidCategory);

  const minimalResult = await createSellerProduct(minimalInvalid);
  const noImagesResult = await createSellerProduct(actualNoImagesInvalidCategory);
  const fullResult = await createSellerProduct(actualInvalidCategory);

  return NextResponse.json({
    ok: true,
    diagnostic: "post-probe",
    product: {
      id: product.id,
      name: product.finalName,
      status: product.status,
    },
    explanation: "모든 호출은 displayCategoryCode=0으로 바꿔 실제 상품 생성이 되지 않도록 한 POST 게이트웨이/본문 진단입니다.",
    stats: {
      actual: payloadStats(actualPayload),
      actualNoImagesInvalidCategory: payloadStats(actualNoImagesInvalidCategory),
      actualInvalidCategory: payloadStats(actualInvalidCategory),
    },
    results: {
      minimalInvalid,
      minimalResult,
      noImagesResult,
      fullResult,
    },
    interpretation: {
      ifMinimal403: "최소 POST도 403이면 쿠팡 POST 권한/게이트웨이 문제입니다.",
      ifNoImagesOkButFull403: "이미지 URL 또는 상세 이미지 본문이 WAF 차단 원인일 가능성이 큽니다.",
      ifNoImages403: "이미지 외 필드의 값 또는 전체 상품 payload 구조가 WAF 차단 원인일 가능성이 큽니다.",
      ifAllJsonError: "게이트웨이는 통과합니다. 실제 등록 403은 특정 필드 조합, 카테고리, 이미지, payload 크기 등을 추가 축소해 봐야 합니다.",
    },
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
