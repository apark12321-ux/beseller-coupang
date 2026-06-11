import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "비셀러→쿠팡 등록 대시보드",
  description: "로컬 상품 등록 후보 생성/검수 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
