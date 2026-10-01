"use client";

/**
 * 서휘령 보스전 "랭킹모드" 순위표를 주고받는 통로.
 *
 * lib/backend.ts와 같은 방식 — Supabase 자격증명이 있으면 Supabase RPC를,
 * 없으면 개발용 로컬 백엔드(app/api/boss-ranking)를 쓴다. 순위는 "클리어한 순서"
 * (cleared_at 오름차순) 기준이다.
 *
 * 닉네임은 더 이상 여기서 따로 입력받지 않는다 — "장비 강화"에 등록한 닉네임을
 * 서버가 device_id로 직접 찾아 그대로 쓴다(enhance_identity). 강화에 닉네임을
 * 등록하지 않은 기기는 랭킹모드에 들어올 수 없다(reason:'enhance_not_registered').
 *
 * 로그인이 없는 만큼 완벽한 부정 방지는 아니지만, startBossRankingSession으로
 * 발급받은 1회용 토큰과 최소 경과시간(서버에서 강제) 없이는 등록 자체가 안 되게
 * 막아뒀다 — 최소한 "즉시 등록"하는 건 막는다.
 */

import { backendMode, supabase } from "./supabaseClient";
import { clientId } from "./backend";

export interface RankingEntry {
  nickname: string;
  rank: number;
  clearedAt: number;
}

export interface SubmitResult {
  ok: boolean;
  reason?: "taken" | "device_taken" | "no_session" | "session_used" | "too_fast" | string;
  rank?: number;
}

export interface StartResult {
  ok: boolean;
  reason?: "enhance_not_registered" | "device_taken" | "nickname_conflict" | string;
  token?: string;
  nickname?: string;
}

async function localJson(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} 실패: ${res.status}`);
  return res.json();
}

function normalizeEntry(row: Record<string, unknown>): RankingEntry {
  return {
    nickname: String(row.nickname ?? ""),
    rank: Number(row.rank ?? 0),
    clearedAt: Number(row.cleared_at ?? row.clearedAt ?? 0),
  };
}

function normalizeList(rows: unknown): RankingEntry[] {
  return Array.isArray(rows) ? rows.map((r) => normalizeEntry(r as Record<string, unknown>)) : [];
}

/**
 * 랭킹모드 전투를 실제로 시작할 때 한 번 호출 — 1회용 토큰을 발급받는다. 이 기기가
 * "장비 강화"에 등록한 닉네임을 서버가 그대로 가져다 쓰므로 닉네임을 보내지 않는다.
 * 강화 미등록이면 reason:'enhance_not_registered'.
 */
export async function startBossRankingSession(): Promise<StartResult> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("boss_ranking_start", { p_device: clientId() });
    if (error) throw new Error(error.message);
    return data as StartResult;
  }
  return (await localJson("/api/boss-ranking/start", { deviceId: clientId() })) as unknown as StartResult;
}

/** 서휘령(2페이즈) 격파 시 한 번 호출 — startBossRankingSession에서 받은 토큰이 필요하다.
 *  토큰이 없거나·이미 썼거나·시작한 지 너무 얼마 안 됐거나·닉네임이 이미 등록돼 있으면
 *  (경합 포함) ok:false. */
export async function submitBossClear(token: string): Promise<SubmitResult> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("boss_ranking_submit", { p_device: clientId(), p_token: token });
    if (error) throw new Error(error.message);
    return data as SubmitResult;
  }
  return (await localJson("/api/boss-ranking/submit", { deviceId: clientId(), token })) as unknown as SubmitResult;
}

export async function fetchRankings(
  nickname?: string
): Promise<{ top: RankingEntry[]; mine: RankingEntry | null }> {
  if (backendMode === "supabase") {
    const client = supabase();
    const [topResult, mineResult] = await Promise.all([
      client.rpc("boss_ranking_top", { p_limit: 10 }),
      nickname ? client.rpc("boss_ranking_mine", { p_nickname: nickname }) : Promise.resolve({ data: null, error: null }),
    ]);
    if (topResult.error) throw new Error(topResult.error.message);
    if (mineResult.error) throw new Error(mineResult.error.message);
    return {
      top: normalizeList(topResult.data),
      mine: mineResult.data ? normalizeEntry(mineResult.data as Record<string, unknown>) : null,
    };
  }
  const qs = nickname ? `?nickname=${encodeURIComponent(nickname)}` : "";
  const data = await localJson(`/api/boss-ranking${qs}`);
  return {
    top: normalizeList(data.top),
    mine: data.mine ? normalizeEntry(data.mine as Record<string, unknown>) : null,
  };
}
