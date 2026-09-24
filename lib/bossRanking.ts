"use client";

/**
 * 서휘령 보스전 "랭킹모드" 순위표를 주고받는 통로.
 *
 * lib/backend.ts와 같은 방식 — Supabase 자격증명이 있으면 Supabase RPC를,
 * 없으면 개발용 로컬 백엔드(app/api/boss-ranking)를 쓴다. 순위는 "클리어한 순서"
 * (cleared_at 오름차순) 기준이며, 닉네임은 대소문자 구분 없이 전역에서 유일해야 한다.
 * 보스전 자체와 마찬가지로 서버 인증 없는 완전 로컬/약식 시스템이라, 닉네임 위조 등의
 * 부정 사용을 막는 별도 보안장치는 없다(참가자 친선용).
 */

import { backendMode, supabase } from "./supabaseClient";

export interface RankingEntry {
  nickname: string;
  rank: number;
  clearedAt: number;
}

export interface SubmitResult {
  ok: boolean;
  reason?: "invalid" | "taken" | string;
  rank?: number;
}

const NICKNAME_MAX_LEN = 14;

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

/** 닉네임 형식이 유효한지(길이) — 서버에도 같은 제한이 있지만, 입력창에서 먼저 걸러준다. */
export function isNicknameFormatValid(nickname: string): boolean {
  const trimmed = nickname.trim();
  return trimmed.length >= 1 && trimmed.length <= NICKNAME_MAX_LEN;
}

export async function checkNicknameAvailable(nickname: string): Promise<boolean> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("boss_ranking_check", { p_nickname: nickname });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }
  const data = await localJson("/api/boss-ranking/check", { nickname });
  return Boolean(data.available);
}

/** 서휘령(2페이즈) 격파 시 한 번 호출 — 닉네임이 이미 등록돼 있으면(경합 포함) ok:false. */
export async function submitBossClear(nickname: string): Promise<SubmitResult> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("boss_ranking_submit", { p_nickname: nickname });
    if (error) throw new Error(error.message);
    return data as SubmitResult;
  }
  return (await localJson("/api/boss-ranking/submit", { nickname })) as unknown as SubmitResult;
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

/** 이 기기에서 마지막으로 랭킹모드에 쓴 닉네임 — 재입력 편의 + "내 순위" 조회용. */
const NICKNAME_STORAGE_KEY = "kyg.bossRankingNickname";

export function loadSavedNickname(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNickname(nickname: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
  } catch {
    /* 저장 실패해도 게임 진행에는 지장 없다 */
  }
}
