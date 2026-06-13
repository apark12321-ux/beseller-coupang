// 시크릿/서명/Authorization 이 화면·로그·리포트로 새지 않도록 하는 마스킹 유틸.

export function maskAccessKey(key: string): string {
  if (!key) return "(미설정)";
  return key.slice(0, 4) + "*".repeat(Math.max(0, key.length - 4));
}

// 어떤 객체/문자열이든 리포트로 내보내기 전에 통과시켜 민감값을 제거한다.
const SENSITIVE_KEYS = [
  "secretkey",
  "secret",
  "authorization",
  "signature",
  "x-coupang-signature",
];

export function scrub(value: unknown): unknown {
  if (typeof value === "string") {
    // Authorization 헤더 형태나 hmac= 형태를 통째로 제거
    return value.replace(/(signature=)[A-Za-z0-9+/=]+/gi, "$1***");
  }
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.includes(k.toLowerCase())) {
        out[k] = "***REDACTED***";
      } else {
        out[k] = scrub(v);
      }
    }
    return out;
  }
  return value;
}
