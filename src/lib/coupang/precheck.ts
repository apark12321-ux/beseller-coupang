import { Product } from "../types";
import { detectBrokenOptionName } from "../pipeline/options";

// 로컬 사전 검증. 쿠팡 호출 전에 차단한다(LOCAL_PRECHECK_BLOCKED).
// 게이트웨이 403 과 절대 섞지 않는다.

export interface PrecheckResult {
  blocked: boolean;
  errors: string[]; // 차단 사유
  warnings: string[]; // 경고(차단 아님)
}

export function precheck(p: Product, resolvedCategoryCode?: string | null): PrecheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (p.status === "excluded") errors.push("판매 제외 상품");

  // 카테고리
  const dcc = resolvedCategoryCode ?? p.category.displayCategoryCode;
  if (!dcc) errors.push("displayCategoryCode 미지정");
  if (p.category.status === "excluded") errors.push("카테고리 제외 상태");
  if (p.category.status === "mismatch_warning") warnings.push(`카테고리 오매칭 경고: ${p.category.reason ?? ""}`);
  if (p.category.status !== "stored_valid" && p.category.status !== "matched") {
    warnings.push("카테고리가 stored_valid/matched 아님 → 확정 권장");
  }

  // 옵션/attributes
  const o = p.option;
  if (!o.itemName) errors.push("옵션 itemName 없음");
  if (!o.quantity || o.quantity < 1) errors.push("수량 누락");
  const hasWeight = !!(o.weightValue && o.weightUnit);
  const hasVolume = !!(o.volumeValue && o.volumeUnit);
  if (!hasWeight && !hasVolume) warnings.push("중량/용량 모두 없음 → 확인 필요");
  if (hasWeight && hasVolume) errors.push("개당 중량/용량 동시 존재 (하나만 허용)");

  const broken = detectBrokenOptionName(p.originalName);
  if (broken) warnings.push(`옵션명 경고: ${broken}`);

  // 가격
  if (o.salePrice <= 0) errors.push("salePrice 0 이하");
  if (o.originalPrice <= o.salePrice) errors.push("originalPrice ≤ salePrice");

  // 이미지/contents
  if (!p.images.representationUrl) errors.push("대표 이미지 없음");
  if (p.images.detailUrls.length === 0) errors.push("상세 이미지 없음 (contents 비어있음)");

  // 고시정보
  if (p.notice.status !== "reviewed" && p.notice.status !== "approved") {
    warnings.push("고시정보 수동 검수 미완료");
  }

  return { blocked: errors.length > 0, errors, warnings };
}
