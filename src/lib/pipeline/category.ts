import { CategoryMatch, ProductStatus } from "../types";
import { TAX_FREE_PREFIXES } from "../config";

// 카테고리 매칭.
// 실전에서는 쿠팡 카테고리 추천 API 결과를 displayCategoryCode 후보로 받고,
// 아래 금지룰로 필터링하는 구조가 안전하다(메타 미연동 상태에선 룰 기반 추천만 수행).

// 절대 매칭되면 안 되는 오매칭(키워드 → 금지 경로 키워드)
const FORBIDDEN: Array<{ when: RegExp; forbid: string; label: string }> = [
  { when: /돌게장|간장게장/, forbid: "국간장", label: "간장게장→국간장 금지" },
  { when: /양파김치/, forbid: "김치양념", label: "양파김치→김치양념 금지" },
  { when: /포기.?배추.?김치|포기김치/, forbid: "고들빼기", label: "포기배추김치→고들빼기 금지" },
  { when: /보쌈김치/, forbid: "갓김치", label: "보쌈김치→갓김치 금지" },
  { when: /홍화씨유|홍화씨기름/, forbid: "MCT", label: "홍화씨유→MCT오일 금지" },
  { when: /^양파|\s양파/, forbid: "무", label: "양파→무 금지" },
  { when: /떡볶이.*양념/, forbid: "굴소스", label: "떡볶이양념→굴소스 금지" },
  { when: /어묵/, forbid: "묵", label: "어묵→묵 금지" },
  { when: /옥수수/, forbid: "수수", label: "옥수수→수수 금지" },
  { when: /삼겹살|등심|목살|갈비/, forbid: "과일", label: "육류→과일 금지" },
  { when: /표고/, forbid: "기타 가공식품", label: "표고버섯→기타가공식품 금지" },
];

// 룰 기반 추천(경로/코드는 운영자가 쿠팡 카테고리 확정 시 채움 → displayCategoryCode)
const RULES: Array<{ when: RegExp; path: string }> = [
  { when: /떡볶이.*양념|분식소스/, path: "식품>장/소스>소스/드레싱/식초>소스류>기타소스" },
  { when: /홍화씨유|홍화씨기름/, path: "식품>식용유/오일>기타오일" },
  { when: /포기.?배추.?김치|포기김치/, path: "식품>김치>배추김치/포기김치" },
  { when: /갓김치/, path: "식품>김치>갓김치" },
  { when: /게장|새우장|전복장/, path: "식품>수산가공>젓갈/반찬" },
  { when: /표고/, path: "신선식품>채소류>버섯류>표고버섯" },
];

export function matchCategory(
  beSellerCode: string | null,
  beSellerLabel: string | null,
  name: string,
  classifyStatus: ProductStatus
): CategoryMatch {
  const code = (beSellerCode || "").trim().toUpperCase();
  const taxType = TAX_FREE_PREFIXES.some((p) => code.startsWith(p)) ? "FREE" : "TAX";

  const base: CategoryMatch = {
    beSellerCode: beSellerCode || null,
    beSellerLabel: beSellerLabel || null,
    displayCategoryCode: null,
    coupangPath: null,
    status: "needs_review",
    reason: null,
    taxType,
  };

  if (classifyStatus === "excluded") {
    return { ...base, status: "excluded", reason: "판매 제외 상품" };
  }

  // 오매칭 가드: 추천 경로가 금지 키워드를 포함하면 경고
  const rule = RULES.find((r) => r.when.test(name));
  if (rule) {
    const violated = FORBIDDEN.find((f) => f.when.test(name) && rule.path.includes(f.forbid));
    if (violated) {
      return { ...base, status: "mismatch_warning", coupangPath: rule.path, reason: violated.label };
    }
    return {
      ...base,
      status: classifyStatus === "needs_review" ? "needs_review" : "matched",
      coupangPath: rule.path,
      reason: classifyStatus === "needs_review" ? "검수 필요 분류 → 카테고리 수동 확정" : null,
    };
  }

  return { ...base, status: "needs_review", reason: "추천 룰 미해당 → 카테고리 수동 지정 필요" };
}

// 오매칭 사후 검사(사용자가 경로 직접 입력 시에도 검증)
export function checkMismatch(name: string, path: string): string | null {
  const v = FORBIDDEN.find((f) => f.when.test(name) && path.includes(f.forbid));
  return v ? v.label : null;
}
