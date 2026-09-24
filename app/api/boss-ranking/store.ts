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

const NICKNAME_MAX_LEN = 14;

const globalStore = globalThis as unknown as {
  __kygBossRankings?: RankingEntry[];
};
const rankings = (globalStore.__kygBossRankings ??= []);

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

export interface SubmitOutcome {
  ok: boolean;
  reason?: "invalid" | "taken";
  rank?: number;
}

export function submitClear(nickname: string): SubmitOutcome {
  const trimmed = nickname.trim();
  if (trimmed.length < 1 || trimmed.length > NICKNAME_MAX_LEN) {
    return { ok: false, reason: "invalid" };
  }
  if (!isNicknameAvailable(trimmed)) {
    return { ok: false, reason: "taken" };
  }
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
