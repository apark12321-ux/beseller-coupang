import { ImageSet } from "../types";
import { BESELLER_IMG_BASE, MAKESHOP_HOST } from "../config";

// 비셀러 상세 이미지 URL 보정.
// - 절대 URL: 그대로
// - 파일명/상대경로: beseller.net 기본 경로로 보정
// - makeshop 호스트 허용

export function fixImageUrl(raw: string, base?: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s; // 절대 URL
  if (s.includes(MAKESHOP_HOST)) return s.startsWith("http") ? s : `https://${s}`;
  const fname = s.replace(/^\/+/, "");
  return (base || BESELLER_IMG_BASE) + fname;
}

export function buildImageSet(detailRaw: string[], base?: string): ImageSet {
  const detailUrls = detailRaw
    .map((r) => fixImageUrl(r, base))
    .filter((x): x is string => !!x);
  const representationUrl = detailUrls[0] ?? null;
  return { representationUrl, detailUrls, introUrl: null, outroUrl: null };
}

// 쿠팡 contents 구성.
// raw.githubusercontent.com intro/outro 이미지는 쿠팡 Akamai 403을 유발하므로 기본 삽입하지 않는다.
// 실제 비셀러/메이크샵 상세 이미지만 전송한다.
export function buildContents(images: ImageSet) {
  const contentDetails = images.detailUrls.map((url) => ({ content: url, detailType: "IMAGE" as const }));
  return [{ contentsType: "IMAGE" as const, contentDetails }];
}
