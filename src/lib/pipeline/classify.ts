import { EXCLUDED_CODES, NEEDS_REVIEW_CODES, INCLUDABLE_CODES, FRUIT_PREFIX } from "../config";
import { ProductStatus } from "../types";

export interface Classification {
  status: ProductStatus;
  reason: string | null;
}

// 과일류 추정(빈 코드 보정용) 키워드
const FRUIT_HINTS = [
  "사과", "배", "감", "귤", "오렌지", "포도", "복숭아", "자두", "키위", "딸기",
  "수박", "참외", "멜론", "체리", "블루베리", "망고", "바나나", "한라봉", "천혜향", "샤인머스캣",
];

export function classify(categoryCode: string, name: string): Classification {
  const code = (categoryCode || "").trim().toUpperCase();

  if (code && EXCLUDED_CODES[code]) {
    return { status: "excluded", reason: `제외 카테고리: ${EXCLUDED_CODES[code]}` };
  }
  if (code && NEEDS_REVIEW_CODES[code]) {
    return { status: "needs_review", reason: `검수 필요 카테고리: ${NEEDS_REVIEW_CODES[code]}` };
  }
  if (code && INCLUDABLE_CODES[code]) {
    return { status: "candidate", reason: null };
  }
  // 과일류(C002005xxx)
  if (code.startsWith(FRUIT_PREFIX)) {
    return { status: "candidate", reason: null };
  }
  // 빈 코드: 상품명으로 과일 추정
  if (!code) {
    if (FRUIT_HINTS.some((h) => name.includes(h))) {
      return { status: "candidate", reason: "빈 코드 → 상품명 기반 과일류 추정" };
    }
    return { status: "needs_review", reason: "category_code 없음 → 수동 분류 필요" };
  }
  // 알 수 없는 코드는 안전하게 검수 필요
  return { status: "needs_review", reason: `미정의 카테고리코드(${code}) → 수동 분류 필요` };
}
