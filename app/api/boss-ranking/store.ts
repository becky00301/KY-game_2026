/**
 * 개발용 로컬 백엔드의 저장소 — 서휘령 보스전 "랭킹모드" 순위표.
 *
 * app/api/sword/store.ts와 같은 이유로 프로세스 메모리에 둔다. 운영에서는 반드시
 * Supabase(boss_ranking_* RPC)를 쓴다.
 */

interface RankingEntry {
  nickname: string;
  clearedAt: number;
}

interface RankingSession {
  token: string;
  nickname: string;
  startedAt: number;
  used: boolean;
}

const NICKNAME_MAX_LEN = 14;
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

export function isNicknameAvailable(nickname: string): boolean {
  const n = norm(nickname);
  if (!n) return false;
  return !rankings.some((r) => norm(r.nickname) === n);
}

export interface StartOutcome {
  ok: boolean;
  reason?: "invalid";
  token?: string;
}

/** 랭킹모드 전투를 실제로 시작할 때(닉네임 확정 직후) 한 번 호출 — 1회용 토큰을 발급한다. */
export function startSession(nickname: string): StartOutcome {
  const trimmed = nickname.trim();
  if (trimmed.length < 1 || trimmed.length > NICKNAME_MAX_LEN) {
    return { ok: false, reason: "invalid" };
  }
  const token = crypto.randomUUID();
  sessions.set(token, { token, nickname: trimmed, startedAt: Date.now(), used: false });
  return { ok: true, token };
}

export interface SubmitOutcome {
  ok: boolean;
  reason?: "invalid" | "taken" | "no_session" | "session_used" | "too_fast";
  rank?: number;
}

export function submitClear(nickname: string, token: string): SubmitOutcome {
  const trimmed = nickname.trim();
  if (trimmed.length < 1 || trimmed.length > NICKNAME_MAX_LEN) {
    return { ok: false, reason: "invalid" };
  }
  const session = sessions.get(token);
  if (!session || norm(session.nickname) !== norm(trimmed)) {
    return { ok: false, reason: "no_session" };
  }
  if (session.used) {
    return { ok: false, reason: "session_used" };
  }
  if (Date.now() - session.startedAt < MIN_SESSION_MS) {
    return { ok: false, reason: "too_fast" };
  }
  if (!isNicknameAvailable(trimmed)) {
    return { ok: false, reason: "taken" };
  }
  session.used = true;
  rankings.push({ nickname: trimmed, clearedAt: Date.now() });
  const rank = sorted().findIndex((r) => norm(r.nickname) === norm(trimmed)) + 1;
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
