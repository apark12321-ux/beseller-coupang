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

function hostOf(raw: string | null | undefined) {
  try { return raw ? new URL(raw).host : null; } catch { return "INVALID_URL"; }
}

function imageHosts(payload: any) {
  const item = payload?.items?.[0] ?? {};
  const images = Array.isArray(item?.images) ? item.images : [];
  const details = Array.isArray(item?.contents?.[0]?.contentDetails) ? item.contents[0].contentDetails : [];
  return {
    itemImageHosts: images.map((x: any) => hostOf(x.vendorPath)),
    contentHosts: details.map((x: any) => ({ type: x.detailType, host: x.detailType === "IMAGE" ? hostOf(x.content) : null })),
  };
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
    contentDetailCount: Array.isArray(contents) ? contents.length : 0,
    contentImageCount: Array.isArray(contents) ? contents.filter((x: any) => x.detailType === "IMAGE").length : 0,
    noticeCount: Array.isArray(item?.notices) ? item.notices.length : 0,
    attributeCount: Array.isArray(item?.attributes) ? item.attributes.length : 0,
    displayCategoryCode: payload?.displayCategoryCode ?? null,
    hosts: imageHosts(payload),
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

function textContents(payload: any) {
  const p = clone(payload);
  if (Array.isArray(p.items) && p.items[0]) {
    p.items[0].contents = [{ contentsType: "TEXT", contentDetails: [{ content: "POST 진단용 상세설명", detailType: "TEXT" }] }];
  }
  return p;
}

function removeImages(payload: any) {
  const p = textContents(payload);
  if (Array.isArray(p.items) && p.items[0]) p.items[0].images = [];
  return p;
}

function representationOnly(payload: any) {
  return textContents(payload);
}

function contentImagesOnly(payload: any) {
  const p = clone(payload);
  if (Array.isArray(p.items) && p.items[0]) p.items[0].images = [];
  return p;
}

function detailImagesOnly(payload: any) {
  const p = clone(payload);
  if (Array.isArray(p.items) && p.items[0]) {
    p.items[0].images = [];
    const details = p.items[0].contents?.[0]?.contentDetails ?? [];
    const filtered = details.filter((x: any) => {
      const host = hostOf(x.content);
      return x.detailType === "IMAGE" && host && !String(host).includes("githubusercontent.com");
    });
    p.items[0].contents = [{ contentsType: "IMAGE", contentDetails: filtered }];
  }
  return p;
}

function introOutroOnly(payload: any) {
  const p = clone(payload);
  if (Array.isArray(p.items) && p.items[0]) {
    p.items[0].images = [];
    const details = p.items[0].contents?.[0]?.contentDetails ?? [];
    const filtered = details.filter((x: any) => {
      const host = hostOf(x.content);
      return x.detailType === "IMAGE" && String(host).includes("githubusercontent.com");
    });
    p.items[0].contents = [{ contentsType: "IMAGE", contentDetails: filtered }];
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

async function run(label: string, payload: any) {
  const result = await createSellerProduct(payload);
  return { label, stats: payloadStats(payload), result };
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

  const invalid = maskPayloadForInvalidCategory(actualPayload);
  const probes = {
    minimal: await run("minimal", minimalInvalid),
    noImages: await run("noImages", removeImages(invalid)),
    representationOnly: await run("representationOnly", representationOnly(invalid)),
    contentImagesOnly: await run("contentImagesOnly", contentImagesOnly(invalid)),
    detailImagesOnly: await run("detailImagesOnly", detailImagesOnly(invalid)),
    introOutroOnly: await run("introOutroOnly", introOutroOnly(invalid)),
    full: await run("full", invalid),
  };

  return NextResponse.json({
    ok: true,
    diagnostic: "post-probe-v2",
    product: {
      id: product.id,
      name: product.finalName,
      status: product.status,
    },
    explanation: "displayCategoryCode=0으로 바꿔 실제 상품 생성 없이 이미지/본문 조합별 403 원인을 찾는 POST 진단입니다.",
    actualStats: payloadStats(actualPayload),
    probes,
    interpretation: {
      representationOnly403: "대표 이미지 vendorPath가 차단 원인일 가능성이 큽니다.",
      contentImagesOnly403: "상세 contents 이미지 중 하나가 차단 원인입니다.",
      detailImagesOnlyOkIntroOutro403: "GitHub raw intro/outro 이미지가 차단 원인일 가능성이 큽니다.",
      detailImagesOnly403: "비셀러/메이크샵 상세 이미지 URL 자체가 차단 원인일 가능성이 큽니다.",
      full403Only: "개별 이미지는 통과하지만 전체 조합/크기/특정 조합이 차단 원인입니다.",
    },
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
