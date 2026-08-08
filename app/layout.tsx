import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "승리의 검 — 고연전 응원 클리커",
  description: "칼을 두드리고, 기운을 모아, 승리의 검을 완성하자.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#12060a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard 가변 폰트 동적 서브셋 — 자체 호스팅(public/fonts/pretendard) */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendard.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
