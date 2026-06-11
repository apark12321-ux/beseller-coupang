import crypto from "crypto";
import { env } from "../config";

// 쿠팡 Open API HMAC 서명 (CEA algorithm).
// datetime(yyMMdd'T'HHmmss'Z') + method + path + query 를 SECRET 으로 HMAC-SHA256.
// Authorization 헤더 전체는 절대 외부로 노출하지 않는다(로그/리포트 금지).

function signedDate(): string {
  // UTC yymmddTHHMMSSZ
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace("Z", "Z").slice(2);
}

export interface SignResult {
  authorization: string; // 사용처: fetch 헤더에만. 로그 금지.
  datetime: string;
}

// path 는 쿼리스트링을 제외한 경로, query 는 '?' 없는 쿼리스트링
export function sign(method: string, urlPath: string, query: string): SignResult {
  const datetime = signedDate();
  const message = datetime + method.toUpperCase() + urlPath + query;
  const signature = crypto
    .createHmac("sha256", env.secretKey)
    .update(message)
    .digest("hex");

  const authorization =
    `CEA algorithm=HmacSHA256, access-key=${env.accessKey}, ` +
    `signed-date=${datetime}, signature=${signature}`;

  return { authorization, datetime };
}

// 키 설정 여부만 안전하게 보고(값 노출 없음)
export function credentialStatus() {
  return {
    accessKeySet: !!env.accessKey,
    secretKeySet: !!env.secretKey,
    vendorIdSet: !!env.vendorId,
  };
}
