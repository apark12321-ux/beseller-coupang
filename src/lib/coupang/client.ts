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
  // JSON 응답이면 파싱 결과(민감정보 없음)
  json: unknown | null;
  // 사람이 읽는 요약(민감정보 제거됨)
  summary: string;
}

function extractAkamaiRef(html: string): string | null {
  const m = html.match(/Reference[^0-9a-fA-F]*([0-9a-fA-F.\-]+)/);
  return m ? m[1] : null;
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
      json: null,
      summary: "쿠팡 게이트웨이 403 Access Denied (HTML). HMAC 기본구조 문제 가능성 낮음, 권한/IP 확인 필요.",
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
    const hasErrorItems = Array.isArray(json.data?.errorItems) && json.data.errorItems.length > 0;
    if (json.code === "SUCCESS" && hasErrorItems) {
      return {
        ok: false, httpStatus: res.status, contentType,
        errorClass: "COUPANG_CREATED_WITH_ERRORS", akamaiReference: null, json,
        summary: "생성됨(SUCCESS) 그러나 errorItems 존재 → 검수 필요",
      };
    }
    if (json.code === "SUCCESS") {
      return {
        ok: true, httpStatus: res.status, contentType,
        errorClass: "COUPANG_CREATED_SUCCESS", akamaiReference: null, json,
        summary: "정상 생성",
      };
    }
    // code/message/errorItems 존재하는 일반 JSON 오류
    return {
      ok: res.ok, httpStatus: res.status, contentType,
      errorClass: "COUPANG_API_JSON_ERROR", akamaiReference: null, json,
      summary: `API 오류: code=${json.code ?? "?"} message=${String(json.message ?? "").slice(0, 200)}`,
    };
  }

  // 기타
  return {
    ok: res.ok, httpStatus: res.status, contentType,
    errorClass: res.ok ? null : "COUPANG_API_JSON_ERROR",
    akamaiReference: null, json: null,
    summary: `HTTP ${res.status} (${contentType})`,
  };
}

// ── GET 진단 ─────────────────────────────────────────────────────────────────
export async function getCategoryMeta(displayCategoryCode: string) {
  return call("GET", `/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/${displayCategoryCode}`);
}

export async function getSellerProducts() {
  const query = `vendorId=${env.vendorId}&maxPerPage=1`;
  return call("GET", `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`, query);
}

// ── POST 상품 생성 (라우트에서 안전장치 통과 후에만 호출) ─────────────────────
export async function createSellerProduct(payload: unknown) {
  return call("POST", `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`, "", payload);
}
