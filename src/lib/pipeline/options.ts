import { OptionInfo, WeightUnit, VolumeUnit } from "../types";

// 비셀러 원본 상품명에서 수량/중량/용량을 파싱한다.
// 가장 중요한 모듈. 깨진 옵션명(1+1 1.4kg 1.4kg, x3 3개 등)을 정규화한다.

interface ParsedOption {
  quantity: number;
  weightValue: number | null;
  weightUnit: WeightUnit | null;
  volumeValue: number | null;
  volumeUnit: VolumeUnit | null;
  flavor: string | null; // 오리지널/집밥만능/매운맛 등 보존 토큰
  confident: boolean; // 자동 파싱 신뢰 여부
}

const FLAVOR_TOKENS = ["오리지널", "집밥만능", "블랙라벨", "매운맛", "순한맛"];

export function parseOption(name: string): ParsedOption {
  let confident = true;

  // 중량: 1.4kg / 1.5 kg / 500g
  const w = name.match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/i);
  // 용량: 500ml / 1.5L / 1l
  const v = name.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i);

  // 수량: 1+1, 1+1+1, x3, 3개, 2개입
  let quantity = 1;
  const plus = name.match(/(\d+(?:\+\d+)+)/); // 1+1, 1+1+1
  const times = name.match(/x\s*(\d+)/i); // x3
  const gae = name.match(/(\d+)\s*개/); // 3개
  if (plus) {
    quantity = plus[1].split("+").reduce((a, b) => a + Number(b), 0);
  } else if (times) {
    quantity = Number(times[1]);
  } else if (gae) {
    quantity = Number(gae[1]);
  }

  const flavor = FLAVOR_TOKENS.find((f) => name.includes(f)) ?? null;

  // 중량/용량 둘 다 없으면 신뢰도 낮음
  if (!w && !v) confident = false;

  const weightValue = w ? Number(w[1]) : null;
  const weightUnit = w ? (w[2].toLowerCase() as WeightUnit) : null;
  const volumeValue = v ? Number(v[1]) : null;
  const volumeUnit = v ? (v[2].toLowerCase() === "l" ? "L" : "ml") : null;

  // 중량·용량 동시 존재 시 정책상 하나만 사용(중량 우선) → 확인 필요 표시
  if (w && v) confident = false;

  return { quantity, weightValue, weightUnit, volumeValue, volumeUnit, flavor, confident };
}

function fmtWeight(val: number, unit: WeightUnit): string {
  return `${val}${unit}`;
}
function fmtVolume(val: number, unit: VolumeUnit): string {
  return `${val}${unit}`;
}

// 권장 옵션명: "집밥만능 1.4kg x 2개" 형태 (깨진 반복 제거)
export function buildOptionName(p: ParsedOption): string {
  const parts: string[] = [];
  if (p.flavor) parts.push(p.flavor);
  if (p.weightValue && p.weightUnit) parts.push(fmtWeight(p.weightValue, p.weightUnit));
  else if (p.volumeValue && p.volumeUnit) parts.push(fmtVolume(p.volumeValue, p.volumeUnit));
  parts.push(`x ${p.quantity}개`);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// 총 구성 / 포장단위 표기: "1.4kg x 2개"
export function buildComposition(p: ParsedOption): string {
  if (p.weightValue && p.weightUnit) return `${fmtWeight(p.weightValue, p.weightUnit)} x ${p.quantity}개`;
  if (p.volumeValue && p.volumeUnit) return `${fmtVolume(p.volumeValue, p.volumeUnit)} x ${p.quantity}개`;
  return `${p.quantity}개`;
}

export function toOptionInfo(
  name: string,
  sku: string,
  salePrice: number,
  originalPrice: number
): OptionInfo {
  const p = parseOption(name);
  return {
    itemName: buildOptionName(p),
    quantity: p.quantity,
    quantityUnit: "개",
    weightValue: p.weightValue,
    weightUnit: p.weightUnit,
    // 중량 우선: 중량이 있으면 용량은 비운다
    volumeValue: p.weightValue ? null : p.volumeValue,
    volumeUnit: p.weightValue ? null : p.volumeUnit,
    composition: buildComposition(p),
    packageUnit: buildComposition(p),
    salePrice,
    originalPrice,
    sku,
    source: p.confident ? "auto" : "needs_confirm",
  };
}

// 옵션 → 쿠팡 attributes (중량/용량 동시 금지)
export function toAttributes(o: OptionInfo): Array<{ attributeTypeName: string; attributeValueName: string }> {
  const attrs: Array<{ attributeTypeName: string; attributeValueName: string }> = [
    { attributeTypeName: "수량", attributeValueName: `${o.quantity}${o.quantityUnit}` },
  ];
  if (o.weightValue && o.weightUnit) {
    attrs.push({ attributeTypeName: "개당 중량", attributeValueName: `${o.weightValue}${o.weightUnit}` });
  } else if (o.volumeValue && o.volumeUnit) {
    attrs.push({ attributeTypeName: "개당 용량", attributeValueName: `${o.volumeValue}${o.volumeUnit}` });
  }
  return attrs;
}

// 깨진 옵션명 감지(경고용)
export function detectBrokenOptionName(raw: string): string | null {
  if (/(\d+\.?\d*\s*(kg|g|ml|l))\b.*\1/i.test(raw)) return "중량/용량 중복 표기";
  if (/\d+(\+\d+)+/.test(raw)) return "1+1 형식 잔존";
  if (/x\s*\d+\s*\d+\s*개/i.test(raw)) return "x3 3개 중복";
  return null;
}
