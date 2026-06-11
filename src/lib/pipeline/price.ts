import { PRICE_POLICY } from "../config";

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
