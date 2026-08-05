import { NextResponse } from "next/server";

/**
 * 개발용 로컬 백엔드는 프로세스 메모리에 상태를 둔다.
 * 서버리스에 올라가면 인스턴스마다 칼이 달라지므로 프로덕션에서는 아예 막는다.
 */
export function blockedInProduction(): NextResponse | null {
  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.NODE_ENV === "production" && !hasSupabase) {
    return NextResponse.json(
      { error: "개발용 로컬 백엔드는 운영에서 쓸 수 없습니다. Supabase를 연결하세요." },
      { status: 503 }
    );
  }
  return null;
}
