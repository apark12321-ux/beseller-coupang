import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { callCoupang } from "@/lib/coupang/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Candidate = {
  label: string;
  apiPath: string;
  query?: string;
};

function collectNumbers(value: unknown, path = "root", out: Array<{ path: string; value: string }> = []) {
  if (value == null) return out;
  if (typeof value === "number" || typeof value === "string") {
    const s = String(value);
    if (/^\d{5,}$/.test(s)) out.push({ path, value: s });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectNumbers(v, `${path}[${i}]`, out));
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) collectNumbers(v, `${path}.${k}`, out);
  }
  return out;
}

function collectLikelyOutboundCodes(value: unknown) {
  const all = collectNumbers(value);
  return all.filter((x) => /outbound|shipping|shipment|place|address|center|code|id|seq/i.test(x.path));
}

function summarizeJson(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const text = JSON.stringify(value);
  return text.length > 3000 ? `${text.slice(0, 3000)}...` : value;
}

export async function GET() {
  const vendorId = env.vendorId;
  const qVendor = new URLSearchParams({ vendorId }).toString();
  const qVendorPage = new URLSearchParams({ vendorId, page: "1", size: "10" }).toString();

  const candidates: Candidate[] = [
    { label: "v4_vendor_outboundShippingPlace", apiPath: `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/outboundShippingPlace` },
    { label: "v4_vendor_outboundShippingPlaces", apiPath: `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/outboundShippingPlaces` },
    { label: "v4_vendor_outboundShippingCenter", apiPath: `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/outboundShippingCenter` },
    { label: "v4_vendor_outboundShippingCenters", apiPath: `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/outboundShippingCenters` },
    { label: "v4_vendor_shippingPlace", apiPath: `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/shippingPlace` },
    { label: "v4_vendor_shippingPlaces", apiPath: `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/shippingPlaces` },
    { label: "v4_vendor_shipmentPlace", apiPath: `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/shipmentPlace` },
    { label: "v4_vendor_shipmentPlaces", apiPath: `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/shipmentPlaces` },

    { label: "v4_query_outboundShippingPlace", apiPath: "/v2/providers/openapi/apis/api/v4/outboundShippingPlace", query: qVendor },
    { label: "v4_query_outboundShippingPlaces", apiPath: "/v2/providers/openapi/apis/api/v4/outboundShippingPlaces", query: qVendor },
    { label: "v4_query_shippingPlace", apiPath: "/v2/providers/openapi/apis/api/v4/shippingPlace", query: qVendor },
    { label: "v4_query_shippingPlaces", apiPath: "/v2/providers/openapi/apis/api/v4/shippingPlaces", query: qVendor },

    { label: "v1_vendor_outboundShippingPlaces", apiPath: `/v2/providers/openapi/apis/api/v1/vendors/${vendorId}/outboundShippingPlaces` },
    { label: "v1_query_outboundShippingPlaces", apiPath: "/v2/providers/openapi/apis/api/v1/outboundShippingPlaces", query: qVendor },

    { label: "seller_marketplace_outboundShippingPlaces", apiPath: "/v2/providers/seller_api/apis/api/v1/marketplace/outboundShippingPlaces", query: qVendorPage },
    { label: "seller_marketplace_shippingPlaces", apiPath: "/v2/providers/seller_api/apis/api/v1/marketplace/shippingPlaces", query: qVendorPage },
  ];

  const results = [];
  for (const c of candidates) {
    const result = await callCoupang("GET", c.apiPath, c.query ?? "");
    results.push({
      ...c,
      ok: result.ok,
      httpStatus: result.httpStatus,
      summary: result.summary,
      likelyCodes: collectLikelyOutboundCodes(result.json),
      json: summarizeJson(result.json),
    });
  }

  const successes = results.filter((x) => x.ok || x.httpStatus === 200);

  return NextResponse.json({
    ok: true,
    diagnostic: "outbound-hunt",
    note: "GET만 호출합니다. 실제 출고지 생성/상품 등록은 하지 않습니다. 성공한 항목의 likelyCodes에서 outboundShippingPlaceCode/shippingPlaceCode/shippingPlaceId/placeCode 계열 숫자를 찾습니다.",
    currentEnv: {
      outboundShippingPlaceCode: env.outboundShippingPlaceCode,
      returnCenterCode: env.returnCenterCode,
      relayConfigured: !!env.relayUrl,
    },
    successCount: successes.length,
    successes,
    results,
  });
}
