import { ImageSet } from "../types";
import { env, BESELLER_IMG_BASE, MAKESHOP_HOST } from "../config";

// 비셀러 상세 이미지 URL 보정.
// - 절대 URL: 그대로
// - 파일명/상대경로: beseller.net 기본 경로로 보정
// - makeshop 호스트 허용

export function fixImageUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s; // 절대 URL
  if (s.includes(MAKESHOP_HOST)) return s.startsWith("http") ? s : `https://${s}`;
  // 파일명 또는 상대경로
  const fname = s.replace(/^\/+/, "");
  return BESELLER_IMG_BASE + fname;
}

export function buildImageSet(detailRaw: string[]): ImageSet {
  const detailUrls = detailRaw
    .map(fixImageUrl)
    .filter((x): x is string => !!x);

  // 대표 이미지: 첫 번째 유효 상세 이미지(없으면 null → pre-check 차단)
  const representationUrl = detailUrls[0] ?? null;

  return {
    representationUrl,
    detailUrls,
    introUrl: env.introUrl,
    outroUrl: env.outroUrl,
  };
}

// 쿠팡 contents 구성: intro + 상세들 + outro (모두 IMAGE)
export function buildContents(images: ImageSet) {
  const details = [
    { content: images.introUrl, detailType: "IMAGE" as const },
    ...images.detailUrls.map((url) => ({ content: url, detailType: "IMAGE" as const })),
    { content: images.outroUrl, detailType: "IMAGE" as const },
  ];
  return [{ contentsType: "IMAGE" as const, contentDetails: details }];
}
