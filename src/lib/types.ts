// ────────────────────────────────────────────────────────────────────────────
// 데이터 모델. 모든 상태/플래그는 여기서 단일 정의한다.
// ────────────────────────────────────────────────────────────────────────────

export type ProductStatus =
  | "candidate" // 정상 등록 후보
  | "ready" // Dry Run 통과 = 등록 준비 완료
  | "needs_review" // 검수 필요
  | "excluded" // 판매 제외
  | "registered" // 등록 완료
  | "draft_saved" // 쿠팡 임시저장됨
  | "register_failed"; // 등록 실패

export type CategoryStatus =
  | "matched"
  | "stored_valid"
  | "needs_review"
  | "excluded"
  | "mismatch_warning";

export type NoticeStatus = "not_started" | "not_reviewed" | "reviewed" | "approved";

export type FieldSource = "auto" | "user" | "needs_confirm"; // 자동추출 / 사용자수정 / 확인필요

export type ErrorClass =
  | "LOCAL_PRECHECK_BLOCKED"
  | "COUPANG_GATEWAY_ACCESS_DENIED"
  | "COUPANG_API_JSON_ERROR"
  | "COUPANG_CREATED_WITH_ERRORS"
  | "COUPANG_CREATED_SUCCESS";

// ── 옵션 단위 ────────────────────────────────────────────────────────────────
export type WeightUnit = "kg" | "g";
export type VolumeUnit = "ml" | "L";

export interface OptionInfo {
  itemName: string;
  quantity: number; // 수량
  quantityUnit: string; // 보통 "개"
  weightValue: number | null; // 개당 중량
  weightUnit: WeightUnit | null;
  volumeValue: number | null; // 개당 용량
  volumeUnit: VolumeUnit | null;
  composition: string; // 총 구성 (notices/포장단위 표기용)
  packageUnit: string; // 고시정보 포장단위
  salePrice: number;
  originalPrice: number;
  sku: string; // externalVendorSku
  source: FieldSource; // 이 옵션 정보 전체의 출처 상태
}

// ── 카테고리 ─────────────────────────────────────────────────────────────────
export interface CategoryMatch {
  beSellerCode: string | null; // 비셀러 category_code (A열)
  beSellerLabel: string | null;
  displayCategoryCode: string | null; // 쿠팡 노출 카테고리 코드
  coupangPath: string | null; // 쿠팡 카테고리 경로(사람 확인용)
  status: CategoryStatus;
  reason: string | null; // 제외/경고 사유
  taxType: "TAX" | "FREE"; // 과세/면세
}

// ── 고시정보 ─────────────────────────────────────────────────────────────────
export interface NoticeField {
  name: string;
  content: string;
}
export interface NoticeBlock {
  templateId: "food_processed" | "agri_marine"; // 가공식품 / 농수산물
  noticeCategoryName: string; // 쿠팡 noticeCategoryName
  fields: NoticeField[];
  status: NoticeStatus;
}

// ── 이미지 ───────────────────────────────────────────────────────────────────
export interface ImageSet {
  representationUrl: string | null; // 대표 이미지(필수)
  detailUrls: string[]; // 상세 이미지(보정 완료된 URL)
  introUrl: string;
  outroUrl: string;
}

// ── 상품 ─────────────────────────────────────────────────────────────────────
export interface Product {
  id: string; // product_uid (내부 키)
  uploadId: string;
  rowIndex: number; // 원본 CSV 행 번호
  externalVendorSku: string;

  originalName: string; // 비셀러 원본 상품명
  beSellerCode: string; // 비셀러 카테고리코드(원본) — catmap 매핑/집계용
  finalName: string; // 최종 상품명(대표)
  nameCandidates: string[]; // 아이템위너 회피용 후보
  nameSource: FieldSource;

  supplyPrice: number; // 비셀러 공급가(원가)

  status: ProductStatus;
  blockReasons: string[]; // 차단/경고 사유(UI 표시)

  category: CategoryMatch;
  option: OptionInfo;
  notice: NoticeBlock;
  images: ImageSet;
  rawImages: string[]; // 원본 이미지 파일명(베이스 재적용용)

  // 사용자 수정값 보호: 키별로 사용자가 직접 손댄 필드 목록.
  // 자동 재생성 시 이 목록에 든 필드는 덮어쓰지 않는다.
  userEditedFields: string[];

  // 등록/진단 이력
  dryRunOk: boolean;
  lastErrorClass: ErrorClass | null;
  lastResultSummary: string | null;

  createdAt: string;
  updatedAt: string;
}

// ── 업로드 ───────────────────────────────────────────────────────────────────
export interface Upload {
  id: string;
  filename: string;
  rowCount: number;
  createdAt: string;
}

// ── 쿨다운/시스템 상태 ───────────────────────────────────────────────────────
// ── 설정 (운영자 조정값) ─────────────────────────────────────────────────────
export interface Settings {
  priceMode: "supply" | "sale"; // supply=원가로 보고 마진역산 / sale=판매가 그대로
  feeRate: number; // 쿠팡 수수료율 (supply 모드)
  margin: number; // 목표 마진 (supply 모드)
  originalMultiplier: number; // 정상가 = 판매가 × 배수
  imageBaseUrl: string; // 상세/대표 이미지 파일명 앞에 붙일 베이스 URL
}

// 비셀러 카테고리코드 → 쿠팡 카테고리 일괄 매핑
export interface CategoryMapEntry {
  displayCategoryCode: string;
  coupangPath: string;
}
export type CategoryMap = Record<string, CategoryMapEntry>;

export interface SystemState {
  cooldownUntil: string | null; // 403 발생 시 24h 차단
  lastGetTestOk: boolean;
  lastGetTestAt: string | null;
}

export interface DB {
  uploads: Upload[];
  products: Product[];
  system: SystemState;
}
