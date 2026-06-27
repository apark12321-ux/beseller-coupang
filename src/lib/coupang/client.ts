import { env } from "../config";
import { sign } from "./hmac";
import { ErrorClass } from "../types";

// 쿠팡 API 클라이언트.
// - COUPANG_RELAY_URL 이 있으면 고정 IP 릴레이 서버로 호출한다.
// - 없으면 현재 런타임에서 직접 호출한다.
// - POST는 마지막 단계에서만 라우트 안전장치 통과 후 호출한다.

export interface CoupangResult {
  ok: boolean;
  httpStatus: number;
  contentType: string;
  errorClass: ErrorClass | null;
  akamaiReference: string | null;
  rejectedIp: string | null;
  json: unknown | null;
  summary: string;
}

function extractAkamaiRef(html: string): string | null {
  const m = html.match(/Reference[^0-9a-fA-F]*([0-9a-fA-F.\-]+)/);
  return m ? m[1] : null;
}

function extractNotAllowedIp(message: string): string | null {
  const m = message.match(/ip address\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})\s+is not allowed/i);
  return m ? m[1] : null;
}

function summarizeJson(json: any, fallback = "정상 응답"): string {
  if (!json || typeof json !== "object") return fallback;
  const code = json.code ?? json.resultCode ?? json.status;
  const message = json.message ?? json.resultMessage ?? json.errorMessage ?? json.error;
  if (code || message) return `code=${code ?? "?"} message=${String(message ?? "").slice(0, 200)}`;
  if (Array.isArray(json.data)) return `${fallback} · data ${json.data.length}건`;
  if (Array.isArray(json.content)) return `${fallback} · content ${json.content.length}건`;
  return fallback;
}

function normalizeResult(input: any, fallbackStatus = 502): CoupangResult {
  return {
    ok: !!input?.ok,
    httpStatus: Number(input?.httpStatus ?? fallbackStatus),
    contentType: String(input?.contentType ?? ""),
    errorClass: (input?.errorClass ?? null) as ErrorClass | null,
    akamaiReference: input?.akamaiReference ?? null,
    rejectedIp: input?.rejectedIp ?? null,
    json: input?.json ?? null,
    summary: String(input?.summary ?? input?.message ?? "쿠팡 호출 결과를 해석하지 못했습니다."),
  };
}

async function callViaRelay(method: "GET" | "POST", apiPath: string, query = "", body?: unknown): Promise<CoupangResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${env.relayUrl}/coupang/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Secret": env.relaySecret,
      },
      body: JSON.stringify({ method, apiPath, query, body }),
      cache: "no-store",
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    if (!text.trim()) {
      return {
        ok: false,
        httpStatus: res.status || 502,
        contentType,
        errorClass: "COUPANG_API_JSON_ERROR",
        akamaiReference: null,
        rejectedIp: null,
        json: null,
        summary: `릴레이 응답이 비어 있습니다. Cloudflare Tunnel 또는 PC 릴레이 연결을 확인하세요. HTTP ${res.status}`,
      };
    }

    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    if (!json) {
      return {
        ok: false,
        httpStatus: res.status || 502,
        contentType,
        errorClass: "COUPANG_API_JSON_ERROR",
        akamaiReference: null,
        rejectedIp: null,
        json: null,
        summary: `릴레이가 JSON이 아닌 응답을 반환했습니다: ${text.slice(0, 200)}`,
      };
    }
    return normalizeResult(json, res.status);
  } catch (e: any) {
    return {
      ok: false,
      httpStatus: 504,
      contentType: "",
      errorClass: "COUPANG_API_JSON_ERROR",
      akamaiReference: null,
      rejectedIp: null,
      json: null,
      summary: `릴레이 호출 실패: ${String(e?.message ?? e)}. node server.js와 cloudflared 터널이 모두 켜져 있는지 확인하세요.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callDirect(method: "GET" | "POST", apiPath: string, query = "", body?: unknown): Promise<CoupangResult> {
  const { authorization } = sign(method, apiPath, query);
  const url = env.baseUrl + apiPath + (query ? `?${query}` : "");

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: authorization,
      "X-EXTENDED-Timeout": "90000",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (res.status === 403 && contentType.includes("text/html")) {
    return {
      ok: false,
      httpStatus: 403,
      contentType,
      errorClass: "COUPANG_GATEWAY_ACCESS_DENIED",
      akamaiReference: extractAkamaiRef(text),
      rejectedIp: null,
      json: null,
      summary: "쿠팡 게이트웨이 403 Access Denied. 쿠팡 WING에 등록한 IP와 실제 호출 IP가 다르거나, 해당 IP가 아직 허용되지 않았습니다.",
    };
  }

  let json: any = null;
  try { json = JSON.parse(text); } catch {}

  if (json && typeof json === "object") {
    const code = json.code;
    const upperCode = typeof code === "string" ? code.toUpperCase() : "";
    const message = String(json.message ?? json.resultMessage ?? json.errorMessage ?? json.error ?? "");
    const rejectedIp = extractNotAllowedIp(message);
    const hasErrorItems = Array.isArray(json.data?.errorItems) && json.data.errorItems.length > 0;

    if (res.status === 403 && rejectedIp) {
      return {
        ok: false, httpStatus: res.status, contentType,
        errorClass: "COUPANG_GATEWAY_ACCESS_DENIED", akamaiReference: null, rejectedIp, json,
        summary: `쿠팡 IP 미허용: ${rejectedIp}를 WING OPEN API IP 주소에 추가 등록해야 합니다.`,
      };
    }

    if (upperCode === "SUCCESS" && hasErrorItems) {
      return {
        ok: false, httpStatus: res.status, contentType,
        errorClass: "COUPANG_CREATED_WITH_ERRORS", akamaiReference: null, rejectedIp: null, json,
        summary: "생성됨(SUCCESS) 그러나 errorItems 존재 → 검수 필요",
      };
    }

    if (res.ok && (upperCode === "SUCCESS" || !upperCode)) {
      return {
        ok: true, httpStatus: res.status, contentType,
        errorClass: null, akamaiReference: null, rejectedIp: null, json,
        summary: upperCode === "SUCCESS" ? "정상 응답(SUCCESS)" : summarizeJson(json, "정상 응답"),
      };
    }

    return {
      ok: false, httpStatus: res.status, contentType,
      errorClass: "COUPANG_API_JSON_ERROR", akamaiReference: null, rejectedIp: null, json,
      summary: `API 오류: ${summarizeJson(json, `HTTP ${res.status}`)}`,
    };
  }

  return {
    ok: res.ok,
    httpStatus: res.status,
    contentType,
    errorClass: res.ok ? null : "COUPANG_API_JSON_ERROR",
    akamaiReference: null,
    rejectedIp: null,
    json: null,
    summary: `HTTP ${res.status} (${contentType})`,
  };
}

async function call(method: "GET" | "POST", apiPath: string, query = "", body?: unknown): Promise<CoupangResult> {
  if (env.relayUrl && env.relaySecret) return callViaRelay(method, apiPath, query, body);
  return callDirect(method, apiPath, query, body);
}

export async function getCategoryMeta(displayCategoryCode: string) {
  return call("GET", `/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/${displayCategoryCode}`);
}

export async function getSellerProducts() {
  const query = new URLSearchParams({
    vendorId: env.vendorId,
    nextToken: "1",
    maxPerPage: "1",
  }).toString();
  return call("GET", `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`, query);
}

export async function createSellerProduct(payload: unknown) {
  return call("POST", `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`, "", payload);
}

export async function predictCategory(productName: string) {
  return call("POST", `/v2/providers/openapi/apis/api/v1/categorization/predict`, "", { productName });
}
