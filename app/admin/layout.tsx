import type { Metadata } from "next";

/** 검색엔진에 올라가지 않도록 — 숨겨진 운영자 주소다. */
export const metadata: Metadata = {
  title: "운영 현황판",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
