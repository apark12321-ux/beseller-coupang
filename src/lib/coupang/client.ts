import { env } from "../config";
import { sign } from "./hmac";
import { ErrorClass } from "../types";

// 쿠팡 API 클라이언트.
// - GET: 진단/테스트용
// - POST: 마지막 단계에서만, 라우트에서 안전장치 통과 후 호출
// 응답을 분류해서 로컬 차단(LOCAL_PRECHECK_BLOCKED) 과 게이트웨이 403 을 절대 섞지 않는다.

export interface CoupangResult {
  ok: boolean;
  httpStatus: number;
  contentType: string;
  errorClass: ErrorClass | null;
  // 게이트웨이 403 HTML 에서 추출
  akamaiReference: string | null;
  // 쿠팡 JSON 403 메시지에서 추출한 미허용 호출 IP
  rejectedIp: string | null;
  // JSON 응답이면 파싱 결과(민감정보 없음)
  json: unknown | null;
  // 사람이 읽는 요약(민감정보 제거됨)
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

async function call(method: "GET" | "POST", apiPath: string, query = "", body?: unknown): Promise<CoupangResult> {
  const { authorization } = sign(method, apiPath, query);
  const url = env.baseUrl + apiPath + (query ? `?${query}` : "");

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: authorization, // fetch 헤더에만 존재. 로깅하지 않음.
      "X-EXTENDED-Timeout": "90000",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  // 게이트웨이 403 (Akamai Access Denied HTML)
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

  // JSON 응답
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }

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

  // 기타
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

// ── GET 진단 ─────────────────────────────────────────────────────────────────
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

// ── POST 상품 생성 (라우트에서 안전장치 통과 후에만 호출) ─────────────────────
export async function createSellerProduct(payload: unknown) {
  return call("POST", `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`, "", payload);
}

// 카테고리 자동추천 (쿠팡 categorization/predict). 등록 IP에서만 동작(아니면 403).
export async function predictCategory(productName: string) {
  return call("POST", `/v2/providers/openapi/apis/api/v1/categorization/predict`, "", { productName });
}
