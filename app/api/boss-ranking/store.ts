/**
 * 개발용 로컬 백엔드의 저장소 — 서휘령 보스전 "랭킹모드" 순위표.
 *
 * app/api/sword/store.ts와 같은 이유로 프로세스 메모리에 둔다. 운영에서는 반드시
 * Supabase(boss_ranking_* RPC)를 쓴다.
 *
 * 닉네임은 더 이상 여기서 직접 입력받지 않는다 — "장비 강화"에 등록한 닉네임을
 * 그대로 쓴다(getByDeviceAnyTeam). 강화 등록이 없으면 랭킹모드에 들어올 수 없다.
 */

import { getByDeviceAnyTeam } from "../enhance/store";

interface RankingEntry {
  nickname: string;
  clearedAt: number;
  deviceId?: string;
}

interface RankingSession {
  token: string;
  nickname: string;
  startedAt: number;
  used: boolean;
  deviceId?: string;
}

/** 전투 시작(boss_ranking_start) 후 이만큼 지나야 격파 등록을 받아준다 — Supabase RPC와 동일한 값. */
const MIN_SESSION_MS = 60_000;

const globalStore = globalThis as unknown as {
  __kygBossRankings?: RankingEntry[];
  __kygBossRankingSessions?: Map<string, RankingSession>;
};
const rankings = (globalStore.__kygBossRankings ??= []);
const sessions = (globalStore.__kygBossRankingSessions ??= new Map<string, RankingSession>());

function norm(nickname: string): string {
  return nickname.trim().toLowerCase();
}

function sorted(): RankingEntry[] {
  return [...rankings].sort((a, b) => a.clearedAt - b.clearedAt);
}

/** 이 기기가 이미 순위표에 한 자리를 차지했는지 — Supabase의 device_id 유니크 인덱스와 같은 역할. */
export function isDeviceRegistered(deviceId?: string): boolean {
  if (!deviceId) return false;
  return rankings.some((r) => r.deviceId === deviceId);
}

export function isNicknameAvailable(nickname: string): boolean {
  const n = norm(nickname);
  if (!n) return false;
  return !rankings.some((r) => norm(r.nickname) === n);
}

export interface StartOutcome {
  ok: boolean;
  reason?: "enhance_not_registered" | "device_taken" | "nickname_conflict";
  token?: string;
  nickname?: string;
}

/** 랭킹모드 전투를 실제로 시작할 때 한 번 호출 — 강화 닉네임을 그대로 써서 1회용 토큰을 발급한다. */
export function startSession(deviceId?: string): StartOutcome {
  const enhance = deviceId ? getByDeviceAnyTeam(deviceId) : null;
  if (!enhance) {
    return { ok: false, reason: "enhance_not_registered" };
  }
  if (isDeviceRegistered(deviceId)) {
    return { ok: false, reason: "device_taken" };
  }
  if (rankings.some((r) => norm(r.nickname) === norm(enhance.nickname) && r.deviceId !== deviceId)) {
    return { ok: false, reason: "nickname_conflict" };
  }
  const token = crypto.randomUUID();
  sessions.set(token, { token, nickname: enhance.nickname, startedAt: Date.now(), used: false, deviceId });
  return { ok: true, token, nickname: enhance.nickname };
}

export interface SubmitOutcome {
  ok: boolean;
  reason?: "taken" | "device_taken" | "no_session" | "session_used" | "too_fast";
  rank?: number;
}

export function submitClear(deviceId: string | undefined, token: string): SubmitOutcome {
  const session = sessions.get(token);
  if (!session || session.deviceId !== deviceId) {
    return { ok: false, reason: "no_session" };
  }
  if (session.used) {
    return { ok: false, reason: "session_used" };
  }
  if (Date.now() - session.startedAt < MIN_SESSION_MS) {
    return { ok: false, reason: "too_fast" };
  }
  if (!isNicknameAvailable(session.nickname)) {
    return { ok: false, reason: "taken" };
  }
  if (isDeviceRegistered(session.deviceId)) {
    return { ok: false, reason: "device_taken" };
  }
  session.used = true;
  rankings.push({ nickname: session.nickname, clearedAt: Date.now(), deviceId: session.deviceId });
  const rank = sorted().findIndex((r) => norm(r.nickname) === norm(session.nickname)) + 1;
  return { ok: true, rank };
}

export interface RankingRow {
  nickname: string;
  rank: number;
  clearedAt: number;
}

export function topRankings(limit = 10): RankingRow[] {
  return sorted()
    .slice(0, limit)
    .map((r, i) => ({ nickname: r.nickname, rank: i + 1, clearedAt: r.clearedAt }));
}

export function myRanking(nickname: string): RankingRow | null {
  const n = norm(nickname);
  const list = sorted();
  const idx = list.findIndex((r) => norm(r.nickname) === n);
  if (idx === -1) return null;
  return { nickname: list[idx].nickname, rank: idx + 1, clearedAt: list[idx].clearedAt };
}
