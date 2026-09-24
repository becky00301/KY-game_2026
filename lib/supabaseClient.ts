"use client";

/**
 * Supabase 클라이언트 싱글톤 — lib/backend.ts(공동 칼)와 lib/bossRanking.ts(서휘령 랭킹)가
 * 함께 쓴다. 자격증명이 없으면 backendMode가 "local"이 되어, 각 모듈은 대신
 * 개발용 로컬 백엔드(app/api/...)를 쓴다.
 */

import { SupabaseClient, createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const backendMode: "supabase" | "local" =
  SUPABASE_URL && SUPABASE_KEY ? "supabase" : "local";

/**
 * 개발용 로컬 백엔드는 프로세스 메모리에 상태를 둔다. 서버리스에 올리면
 * 인스턴스마다 상태가 달라져 "모두가 공유하는" 전제가 조용히 깨진다.
 * 그래서 프로덕션 빌드에서 자격증명이 없으면 게임을 시작하지 않는다.
 */
export const isMisconfigured =
  backendMode === "local" && process.env.NODE_ENV === "production";

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  return client;
}
