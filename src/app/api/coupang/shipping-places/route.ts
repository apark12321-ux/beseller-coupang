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

function collectLikelyCodes(value: unknown) {
  const all = collectNumbers(value);
  return all.filter((x) => /code|id|seq|place|shipping|address|center/i.test(x.path));
}

export async function GET() {
  const vendorId = env.vendorId;
  const candidates: Candidate[] = [
    {
      label: "outboundShippingPlaces_v4_vendor_path",
      apiPath: `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/outboundShippingPlaces`,
    },
    {
      label: "outboundShippingPlaces_v4_query",
      apiPath: "/v2/providers/openapi/apis/api/v4/outboundShippingPlaces",
      query: new URLSearchParams({ vendorId }).toString(),
    },
    {
      label: "returnShippingCenters_v4_vendor_path",
      apiPath: `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/returnShippingCenters`,
    },
    {
      label: "returnShippingCenters_v4_query",
      apiPath: "/v2/providers/openapi/apis/api/v4/returnShippingCenters",
      query: new URLSearchParams({ vendorId }).toString(),
    },
  ];

  const results = [];
  for (const c of candidates) {
    const result = await callCoupang("GET", c.apiPath, c.query ?? "");
    results.push({
      ...c,
      result,
      likelyCodes: collectLikelyCodes(result.json),
    });
  }

  return NextResponse.json({
    ok: true,
    diagnostic: "shipping-places",
    instruction: "성공한 항목의 likelyCodes 중 outboundShippingPlaceCode/shippingPlaceCode/addressId/placeCode 계열 숫자를 COUPANG_OUTBOUND_SHIPPING_PLACE_CODE에 넣으세요. returnShippingCenters의 코드는 COUPANG_RETURN_CENTER_CODE 후보입니다.",
    currentEnv: {
      outboundShippingPlaceCodeSet: !!env.outboundShippingPlaceCode,
      returnCenterCodeSet: !!env.returnCenterCode,
      vendorIdSet: !!vendorId,
    },
    results,
  });
}
