"use client";

/**
 * "강화" 랭킹(닉네임·현재 단계)을 주고받는 통로.
 *
 * lib/bossRanking.ts와 같은 방식 — Supabase 자격증명이 있으면 Supabase RPC를,
 * 없으면 개발용 로컬 백엔드(app/api/enhance)를 쓴다. 노아·연은 서로 다른 아이템을
 * 강화하는 별개의 게임이라 전부 팀 단위로 나뉜다 — 닉네임은 대소문자 구분 없이
 * "같은 팀 안에서만" 유일하고, 기기 하나가 팀별로 각각 한 자리씩 가질 수 있다.
 * 실제 재화 차감·확률 굴림은 contrib(개인 재화)와 같은 신뢰 모델로 클라이언트에서
 * 계산하고, 서버에는 랭킹에 필요한 닉네임·단계만 올라간다.
 */

import { backendMode, supabase } from "./supabaseClient";
import { clientId } from "./backend";
import type { TeamId } from "./game";

export interface EnhanceRankEntry {
  nickname: string;
  level: number;
  rank: number;
  updatedAt: number;
}

export interface EnhanceMe {
  registered: boolean;
  nickname: string;
  level: number;
}

export interface EnhanceIdentity {
  team: TeamId;
  nickname: string;
  level: number;
}

export interface RegisterResult {
  ok: boolean;
  /** "other_team_registered" — 이 기기가 반대 진영에 이미 강화 닉네임을 등록해 둔 경우. */
  reason?: "invalid" | "taken" | "other_team_registered" | string;
  nickname?: string;
  level?: number;
}

export interface ReportResult {
  ok: boolean;
  level?: number;
}

/**
 * 닉네임 길이 한도 — 글자마다 "무게"를 매겨서 영어는 10자, 한글은 8자가 똑같이
 * 한도(10)에 걸리게 맞춘다(한글 1자의 무게 = 10/8 = 1.25). 섞어 쓰면 그 사이 어딘가에서
 * 걸린다. supabase/schema.sql의 nickname_weight 함수가 서버 쪽 동치다 — 둘을 같이
 * 고쳐야 한다.
 */
const HANGUL_CHAR_WEIGHT = 1.25;
const NICKNAME_MAX_WEIGHT = 10;
const HANGUL_RE = /[가-힣]/;

function nicknameWeight(nickname: string): number {
  let weight = 0;
  for (const ch of nickname) weight += HANGUL_RE.test(ch) ? HANGUL_CHAR_WEIGHT : 1;
  return weight;
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

export function isEnhanceNicknameFormatValid(nickname: string): boolean {
  const trimmed = nickname.trim();
  return trimmed.length >= 1 && nicknameWeight(trimmed) <= NICKNAME_MAX_WEIGHT;
}

export async function checkEnhanceNicknameAvailable(nickname: string, team: TeamId): Promise<boolean> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("enhance_nickname_check", { p_nickname: nickname, p_team: team });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }
  const data = await localJson("/api/enhance/check", { nickname, team });
  return Boolean(data.available);
}

/** 이 기기가 이 팀으로 이미 강화 기록을 갖고 있는지 — 있으면 닉네임 입력 단계를 건너뛴다. */
export async function fetchMyEnhance(team: TeamId): Promise<EnhanceMe> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("enhance_me", { p_device: clientId(), p_team: team });
    if (error) throw new Error(error.message);
    const row = data as Record<string, unknown> | null;
    return row && row.nickname
      ? { registered: true, nickname: String(row.nickname), level: Number(row.level ?? 0) }
      : { registered: false, nickname: "", level: 0 };
  }
  const data = await localJson(
    `/api/enhance/me?deviceId=${encodeURIComponent(clientId())}&team=${encodeURIComponent(team)}`
  );
  return data.registered
    ? { registered: true, nickname: String(data.nickname ?? ""), level: Number(data.level ?? 0) }
    : { registered: false, nickname: "", level: 0 };
}

/**
 * 이 기기의 강화 신원을 팀 상관없이 찾는다(한 기기는 한 진영에서만 강화할 수 있어
 * 있어도 하나뿐이다) — 서휘령 랭킹모드가 "강화 닉네임을 그대로 쓸 수 있는지" 판단할
 * 때, 그리고 랭킹모드 "내 순위" 조회에 쓴다. 미등록이면 null.
 */
export async function fetchMyEnhanceIdentity(): Promise<EnhanceIdentity | null> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("enhance_identity", { p_device: clientId() });
    if (error) return null;
    const row = data as Record<string, unknown> | null;
    if (!row || !row.nickname) return null;
    return { team: row.team === "yu" ? "yu" : "ku", nickname: String(row.nickname), level: Number(row.level ?? 0) };
  }
  try {
    const data = await localJson(`/api/enhance/identity?deviceId=${encodeURIComponent(clientId())}`);
    if (!data || !data.nickname) return null;
    return { team: data.team === "yu" ? "yu" : "ku", nickname: String(data.nickname), level: Number(data.level ?? 0) };
  } catch {
    return null;
  }
}

/**
 * 서휘령 TOP10/TOP1 오오라와 강화 24단계 이상 오오라를 둘 다 가진 사람이 채팅창에서
 * 어느 쪽을 보여줄지 고른 값을 저장한다 — 채팅(realtime 전용)과 묶여 있는 기능이라
 * 로컬 개발 백엔드는 지원하지 않는다(chat.ts의 다른 realtime 기능들과 같은 이유).
 */
export async function setChatAuraPreference(
  preference: "rank" | "level" | null,
  team: TeamId
): Promise<{ ok: boolean; reason?: string }> {
  if (backendMode !== "supabase") return { ok: false, reason: "local-mode" };
  const { data, error } = await supabase().rpc("enhance_set_aura_preference", {
    p_device: clientId(),
    p_team: team,
    p_preference: preference,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; reason?: string };
}

/** 닉네임 확정 시 한 번 호출 — 이 기기가 이 팀으로 이미 등록돼 있으면 새 닉네임은 무시하고 기존 기록을 돌려준다. */
export async function registerEnhance(nickname: string, team: TeamId): Promise<RegisterResult> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("enhance_register", {
      p_nickname: nickname,
      p_device: clientId(),
      p_team: team,
    });
    if (error) throw new Error(error.message);
    return data as RegisterResult;
  }
  return (await localJson("/api/enhance/register", {
    nickname,
    deviceId: clientId(),
    team,
  })) as unknown as RegisterResult;
}

/** 레벨이 바뀔 때마다 호출 — fire-and-forget으로 써도 된다(실패해도 로컬 진행에는 지장 없음). */
export async function reportEnhanceLevel(level: number, team: TeamId): Promise<ReportResult> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("enhance_report", {
      p_device: clientId(),
      p_team: team,
      p_level: level,
    });
    if (error) throw new Error(error.message);
    return data as ReportResult;
  }
  return (await localJson("/api/enhance/report", { deviceId: clientId(), team, level })) as unknown as ReportResult;
}

function normalizeEntry(row: Record<string, unknown>): EnhanceRankEntry {
  return {
    nickname: String(row.nickname ?? ""),
    level: Number(row.level ?? 0),
    rank: Number(row.rank ?? 0),
    updatedAt: Number(row.updated_at ?? row.updatedAt ?? 0),
  };
}

function normalizeList(rows: unknown): EnhanceRankEntry[] {
  return Array.isArray(rows) ? rows.map((r) => normalizeEntry(r as Record<string, unknown>)) : [];
}

export async function fetchEnhanceRankings(
  team: TeamId,
  nickname?: string
): Promise<{ top: EnhanceRankEntry[]; mine: EnhanceRankEntry | null }> {
  if (backendMode === "supabase") {
    const client = supabase();
    const [topResult, mineResult] = await Promise.all([
      client.rpc("enhance_top", { p_limit: 10, p_team: team }),
      nickname
        ? client.rpc("enhance_mine", { p_nickname: nickname, p_team: team })
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (topResult.error) throw new Error(topResult.error.message);
    if (mineResult.error) throw new Error(mineResult.error.message);
    return {
      top: normalizeList(topResult.data),
      mine: mineResult.data ? normalizeEntry(mineResult.data as Record<string, unknown>) : null,
    };
  }
  const qs = new URLSearchParams({ team, ...(nickname ? { nickname } : {}) });
  const data = await localJson(`/api/enhance?${qs.toString()}`);
  return {
    top: normalizeList(data.top),
    mine: data.mine ? normalizeEntry(data.mine as Record<string, unknown>) : null,
  };
}
