import { NextResponse } from "next/server";

/**
 * 지금 서버에 올라가 있는 배포의 식별자. 화면은 자기 번들에 박힌 값과 이걸 주기적으로
 * 비교해서, 다르면 새 배포가 나온 것으로 보고 스스로 새로고침한다(components/VersionWatcher).
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { build: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
    { headers: { "cache-control": "no-store" } }
  );
}
