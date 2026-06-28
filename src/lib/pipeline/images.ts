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

function appBaseUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");

  // Vercel 배포 도메인은 매 배포마다 달라질 수 있어 쿠팡 이미지 경로 검증에 불리하다.
  // 현재 운영 도메인을 기본값으로 사용하고, 필요 시 APP_BASE_URL로 덮어쓴다.
  return "https://beseller-coupang.vercel.app";
}

function base64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// 쿠팡 대표이미지는 500x500~5000x5000, 10MB 이하 제한이 엄격하다.
// 원본 비셀러 썸네일이 작을 수 있으므로 대표이미지만 우리 서버에서 800x800 JPG로 정규화한다.
// 쿠팡이 query string 이미지 URL을 "경로 오류"로 반려할 수 있어 .jpg로 끝나는 path URL을 사용한다.
export function normalizeRepresentativeImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.includes("/api/image/representative/") || url.includes("/api/image/representative?")) return url;

  const base = appBaseUrl();
  return `${base}/api/image/representative/${base64Url(url)}.jpg`;
}

export function buildImageSet(detailRaw: string[], base?: string): ImageSet {
  const detailUrls = detailRaw
    .map((r) => fixImageUrl(r, base))
    .filter((x): x is string => !!x);
  const representationUrl = normalizeRepresentativeImageUrl(detailUrls[0] ?? null);
  return { representationUrl, detailUrls, introUrl: "", outroUrl: "" };
}

// 쿠팡 contents 구성.
// raw.githubusercontent.com intro/outro 이미지는 쿠팡 Akamai 403을 유발하므로 기본 삽입하지 않는다.
// 실제 비셀러/메이크샵 상세 이미지만 전송한다.
export function buildContents(images: ImageSet) {
  const contentDetails = images.detailUrls.map((url) => ({ content: url, detailType: "IMAGE" as const }));
  return [{ contentsType: "IMAGE" as const, contentDetails }];
}
