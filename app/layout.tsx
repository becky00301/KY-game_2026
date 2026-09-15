import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://www.eveofvictory.com";
const SITE_TITLE = "뭇별과 승리의 전야제";
const SITE_DESCRIPTION = "칼을 두드리고, 기운을 모아, 승리의 검을 완성하자.";

export const metadata: Metadata = {
  // 링크 미리보기 이미지(app/opengraph-image.jpg)를 절대 주소로 내보내려면 기준 주소가 필요하다.
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
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
      <body>
        <div className="app-frame">{children}</div>
      </body>
    </html>
  );
}
