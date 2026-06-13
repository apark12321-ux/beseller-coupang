import { BRAND, MAX_NAME_LEN } from "../config";

// 상품명 생성.
// 구조: 계절식감 + 차별 형용사 + 핵심 상품명 + 카테고리 수식어
// 규칙: 49자 이내, 용량/수량/옵션 제거, 맛/타입 보존, 반복 단어 제거, 후보 5개

const ADJECTIVES = ["매콤한", "깊은맛", "프리미엄", "정성담은", "집밥같은"];
const SUFFIXES = ["집밥만능 분식소스", "오리지널 양념소스", "국내산 손맛", "정통 반찬", "엄선 식재료"];
const KEEP_TOKENS = ["오리지널", "집밥만능", "블랙라벨", "매운맛", "순한맛"];

// 대표 상품명에서 제거할 용량/수량/옵션 패턴
function stripQuantitySpec(name: string): string {
  return name
    .replace(/\d+(?:\.\d+)?\s*(kg|g|ml|l)\b/gi, "")
    .replace(/\d+(?:\+\d+)+/g, "") // 1+1, 1+1+1
    .replace(/x\s*\d+/gi, "")
    .replace(/\d+\s*개입?/g, "")
    .replace(/[()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 같은 단어 연속/중복 제거 (집밥만능 집밥만능 → 집밥만능)
function dedupeWords(s: string): string {
  const words = s.split(/\s+/);
  const out: string[] = [];
  for (const w of words) {
    if (out.length && out[out.length - 1] === w) continue;
    out.push(w);
  }
  // 비연속 중복도 1회만
  const seen = new Set<string>();
  return out
    .filter((w) => {
      if (seen.has(w)) return false;
      seen.add(w);
      return true;
    })
    .join(" ");
}

function clamp(s: string): string {
  return s.length <= MAX_NAME_LEN ? s : s.slice(0, MAX_NAME_LEN).trim();
}

export interface NameResult {
  finalName: string;
  candidates: string[];
}

export function generateNames(originalName: string): NameResult {
  const core = stripQuantitySpec(originalName);
  const keep = KEEP_TOKENS.filter((t) => originalName.includes(t));

  const candidates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const adj = ADJECTIVES[i % ADJECTIVES.length];
    const suf = SUFFIXES[i % SUFFIXES.length];
    const raw = [BRAND, adj, core, ...keep, suf].filter(Boolean).join(" ");
    candidates.push(clamp(dedupeWords(raw)));
  }

  // 중복 후보 제거 후 5개 보장
  const uniq = Array.from(new Set(candidates));
  while (uniq.length < 5) uniq.push(uniq[uniq.length - 1]);

  return { finalName: uniq[0], candidates: uniq.slice(0, 5) };
}
