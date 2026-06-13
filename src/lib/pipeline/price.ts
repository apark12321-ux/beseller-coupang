import { PRICE_POLICY } from "../config";
import { Settings } from "../types";

// 가격 계산.
// salePrice: 공급가에서 쿠팡 수수료 제외 후 목표 마진(기본 20%)이 남도록 역산.
//   salePrice = 공급가 / (1 - feeRate - margin), 10원 단위 올림
// originalPrice: 소비자 노출 정상가 = roundUpTo100(salePrice * 1.2)
//   (반드시 salePrice 보다 커야 함)

export function roundUpTo(n: number, unit: number): number {
  return Math.ceil(n / unit) * unit;
}

function feeRateFor(categoryCode: string | null): number {
  if (categoryCode) {
    for (const [prefix, rate] of Object.entries(PRICE_POLICY.feeByCategoryPrefix)) {
      if (categoryCode.startsWith(prefix)) return rate;
    }
  }
  return PRICE_POLICY.defaultFeeRate;
}

export interface PriceResult {
  salePrice: number;
  originalPrice: number;
  marginRate: number; // 실제 마진율(검증용)
  warning: string | null;
}

export function calcPrice(supplyPrice: number, categoryCode: string | null): PriceResult {
  const fee = feeRateFor(categoryCode);
  const denom = 1 - fee - PRICE_POLICY.targetMargin;

  if (supplyPrice <= 0) {
    return { salePrice: 0, originalPrice: 0, marginRate: 0, warning: "공급가 없음/0" };
  }
  if (denom <= 0) {
    return { salePrice: 0, originalPrice: 0, marginRate: 0, warning: "수수료+마진 ≥ 100% (정책 오류)" };
  }

  const salePrice = roundUpTo(supplyPrice / denom, 10);
  let originalPrice = roundUpTo(salePrice * 1.2, 100);

  let warning: string | null = null;
  if (originalPrice <= salePrice) {
    originalPrice = roundUpTo(salePrice + 1, 100);
    warning = "originalPrice 자동 보정(판매가 이하 방지)";
  }

  // 실제 마진율 = (판매가 - 수수료 - 공급가) / 판매가
  const marginRate = (salePrice - salePrice * fee - supplyPrice) / salePrice;

  return { salePrice, originalPrice, marginRate, warning };
}

// 사용자가 판매가를 직접 바꿨을 때 정상가 재계산
export function recalcOriginal(salePrice: number): { originalPrice: number; warning: string | null } {
  let originalPrice = roundUpTo(salePrice * 1.2, 100);
  let warning: string | null = null;
  if (originalPrice <= salePrice) {
    originalPrice = roundUpTo(salePrice + 1, 100);
    warning = "originalPrice 자동 보정";
  }
  return { originalPrice, warning };
}

// 설정 기반 가격 계산. priceMode=supply(원가→마진역산) / sale(판매가 그대로)
export function calcPriceWithSettings(inputPrice: number, s: Settings): PriceResult {
  if (inputPrice <= 0) return { salePrice: 0, originalPrice: 0, marginRate: 0, warning: "공급가 없음/0" };

  let salePrice: number;
  let marginRate = 0;
  let warning: string | null = null;

  if (s.priceMode === "sale") {
    // 입력값을 판매가로 그대로 사용(10원 올림)
    salePrice = roundUpTo(inputPrice, 10);
  } else {
    const denom = 1 - s.feeRate - s.margin;
    if (denom <= 0) return { salePrice: 0, originalPrice: 0, marginRate: 0, warning: "수수료+마진 ≥ 100%" };
    salePrice = roundUpTo(inputPrice / denom, 10);
    marginRate = (salePrice - salePrice * s.feeRate - inputPrice) / salePrice;
  }

  let originalPrice = roundUpTo(salePrice * s.originalMultiplier, 100);
  if (originalPrice <= salePrice) { originalPrice = roundUpTo(salePrice + 1, 100); warning = "정상가 자동 보정"; }

  return { salePrice, originalPrice, marginRate, warning };
}
