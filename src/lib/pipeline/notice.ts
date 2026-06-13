import { NoticeBlock } from "../types";
import { CS_PHONE } from "../config";

// 고시정보 템플릿.
// 가공식품(food_processed) / 농수산물(agri_marine) 2종.
// 기본값은 "상세페이지 참조" 허용, 소비자상담은 CS_PHONE 고정.

const REF = "상세페이지 참조";

const PROCESSED_FIELDS = [
  "제품명",
  "식품의 유형",
  "생산자 및 소재지",
  "제조연월일, 소비기한 또는 품질유지기한",
  "포장단위별 내용물의 용량(중량), 수량",
  "원재료명 및 함량",
  "영양성분",
  "유전자변형식품 해당 여부",
  "소비자안전 주의사항",
  "수입식품 문구",
  "소비자상담 전화번호",
];

const AGRI_FIELDS = [
  "품목 또는 명칭",
  "포장단위별 내용물의 용량(중량), 수량, 크기",
  "생산자(수입자)",
  "원산지",
  "제조연월일, 소비기한 또는 품질유지기한",
  "상품구성",
  "보관방법 또는 취급방법",
  "소비자안전 주의사항",
  "수입식품 문구",
  "소비자상담 전화번호",
];

export function buildNotice(
  isAgriMarine: boolean,
  packageUnit: string,
  origin?: string
): NoticeBlock {
  const templateId = isAgriMarine ? "agri_marine" : "food_processed";
  const fieldNames = isAgriMarine ? AGRI_FIELDS : PROCESSED_FIELDS;

  const fields = fieldNames.map((name) => {
    if (name.includes("포장단위별")) return { name, content: packageUnit || REF };
    if (name.includes("소비자상담")) return { name, content: CS_PHONE };
    if (name === "원산지" && origin) return { name, content: origin };
    return { name, content: REF };
  });

  return {
    templateId,
    noticeCategoryName: isAgriMarine ? "농수산물" : "가공식품",
    fields,
    status: "not_reviewed",
  };
}

// 농수산물 판별(과일·농산물·수산 미·약가공) → 농수산물 고시 템플릿
const AGRI_PREFIXES = ["C002005", "C002003", "C002004", "C003003"];
export function isAgriMarine(categoryCode: string | null): boolean {
  const code = (categoryCode || "").toUpperCase();
  return AGRI_PREFIXES.some((p) => code.startsWith(p));
}
