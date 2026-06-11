// 환경변수 + 상수 단일 출처.
// 절대 .env.local 원문을 응답/로그/리포트로 내보내지 않는다.

export const env = {
  accessKey: process.env.COUPANG_ACCESS_KEY ?? "",
  secretKey: process.env.COUPANG_SECRET_KEY ?? "",
  vendorId: process.env.COUPANG_VENDOR_ID ?? "A00798505",
  baseUrl: (process.env.COUPANG_BASE_URL ?? "https://api-gateway.coupang.com").replace(/\/$/, ""),
  outboundShippingPlaceCode: process.env.COUPANG_OUTBOUND_SHIPPING_PLACE_CODE ?? "21091381",
  returnCenterCode: process.env.COUPANG_RETURN_CENTER_CODE ?? "1001922983",
  vendorUserId: process.env.COUPANG_VENDOR_USER_ID ?? "jcompany01",
  introUrl:
    process.env.DETAIL_INTRO_IMAGE_URL ??
    "https://raw.githubusercontent.com/jhko0174/jcom0174/main/detail/01.jpg",
  outroUrl:
    process.env.DETAIL_OUTRO_IMAGE_URL ??
    "https://raw.githubusercontent.com/jhko0174/jcom0174/main/detail/02.jpg",
};

export const BRAND = "계절식감";
export const CS_PHONE = "070-8064-4749";
export const MAX_NAME_LEN = 49;

// ── 가격 정책 (DECISIONS.md 참고. 카테고리별 override 가능) ───────────────────
export const PRICE_POLICY = {
  defaultFeeRate: 0.108, // 쿠팡 판매수수료 기본 가정치
  targetMargin: 0.2, // 목표 마진
  // 카테고리 prefix → 수수료율 override
  feeByCategoryPrefix: {} as Record<string, number>,
};

// ── 카테고리 분류 ────────────────────────────────────────────────────────────
export const EXCLUDED_CODES: Record<string, string> = {
  C002002001: "건강기능식품",
  C002002002: "홍삼/건강기능성 의심",
  C002006001: "축산물/소고기/한우",
  C002006002: "축산물/돼지고기",
  C002004003: "생물/활수산",
};

export const NEEDS_REVIEW_CODES: Record<string, string> = {
  C002002003: "건강식품/차/즙/꿀/효소류",
  C002003004: "산양삼/인삼류",
  C002004001: "수산가공",
  C002007002: "게장/젓갈/새우장/전복장",
  C002006003: "구운란/가공란",
};

export const INCLUDABLE_CODES: Record<string, string> = {
  C002007001: "김치류",
  C002001005: "소스/양념장",
  C002001007: "식용유",
  C002003003: "쌀/잡곡",
  C002004002: "김/해조류",
  C002004004: "건어물",
};

// ── 과세/면세 (DECISIONS.md) ─────────────────────────────────────────────────
// 면세: 미가공 농수산물(과일/쌀/잡곡/생채소). 과세: 가공식품(김치/소스/식용유/건어물 등)
export const TAX_FREE_PREFIXES = ["C002005", "C002003003"]; // 과일류, 쌀/잡곡

// ── 배송/반품 고정값 (스펙 §10, 오타 포함 명세 그대로 유지) ──────────────────
export const DELIVERY = {
  deliveryMethod: "SEQUENCIAL",
  deliveryCompanyCode: "HANJIN",
  deliveryChargeType: "FREE",
  deliveryCharge: 0,
  freeShipOverAmount: 0,
  deliveryChargeOnReturn: 4000,
  returnCharge: 4000,
  remoteAreaDeliverable: "N",
  unionDeliveryType: "NOT_UNION_DELIVERY",
  returnChargeName: "향동",
  companyContactNumber: CS_PHONE,
  returnZipCode: "10545",
  returnAddress: "경기도 고양시 덕양구 향동로 217",
  returnAddressDetail: "디엠씨플렉스데시앙 F507호",
  outboundShippingTimeDay: 1,
};

// ── 이미지 URL 보정 ──────────────────────────────────────────────────────────
export const BESELLER_IMG_BASE = "https://beseller.net/shopimages/beseller/";
export const MAKESHOP_HOST = "beseller.img50.makeshop.info";
