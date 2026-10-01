/**
 * 개발용 로컬 백엔드의 저장소 — "강화" 미니게임의 기기별 진행도 + 랭킹.
 *
 * app/api/boss-ranking/store.ts와 같은 이유로 프로세스 메모리에 둔다. 운영에서는
 * 반드시 Supabase(enhance_* RPC)를 쓴다.
 */

const NICKNAME_MAX_LEN = 14;
const MAX_LEVEL = 30;

interface EnhanceRow {
  deviceId: string;
  team: string;
  nickname: string;
  level: number;
  updatedAt: number;
}

const globalStore = globalThis as unknown as {
  __kygEnhancePlayers?: Map<string, EnhanceRow>;
};
const players = (globalStore.__kygEnhancePlayers ??= new Map<string, EnhanceRow>());

function norm(nickname: string): string {
  return nickname.trim().toLowerCase();
}

function isNicknameTaken(nickname: string): boolean {
  const n = norm(nickname);
  for (const row of players.values()) {
    if (norm(row.nickname) === n) return true;
  }
  return false;
}

export function isNicknameAvailable(nickname: string): boolean {
  const n = norm(nickname);
  if (!n) return false;
  return !isNicknameTaken(nickname);
}

export function getByDevice(deviceId: string): EnhanceRow | null {
  return players.get(deviceId) ?? null;
}

export interface RegisterOutcome {
  ok: boolean;
  reason?: "invalid" | "taken";
  nickname?: string;
  level?: number;
}

/** 이 기기가 이미 등록돼 있으면 새 닉네임은 무시하고 기존 기록을 돌려준다. */
export function register(nickname: string, deviceId: string, team: string): RegisterOutcome {
  const existing = players.get(deviceId);
  if (existing) {
    return { ok: true, nickname: existing.nickname, level: existing.level };
  }
  const trimmed = nickname.trim();
  if (trimmed.length < 1 || trimmed.length > NICKNAME_MAX_LEN) {
    return { ok: false, reason: "invalid" };
  }
  if (isNicknameTaken(trimmed)) {
    return { ok: false, reason: "taken" };
  }
  players.set(deviceId, { deviceId, team, nickname: trimmed, level: 0, updatedAt: Date.now() });
  return { ok: true, nickname: trimmed, level: 0 };
}

export interface ReportOutcome {
  ok: boolean;
  level?: number;
}

/** 레벨이 오를 때만 반영한다 — 내려가는 값은 무시. */
export function reportLevel(deviceId: string, level: number): ReportOutcome {
  const row = players.get(deviceId);
  if (!row) return { ok: false };
  const clamped = Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)));
  if (clamped > row.level) {
    row.level = clamped;
    row.updatedAt = Date.now();
  }
  return { ok: true, level: row.level };
}

export interface RankRow {
  nickname: string;
  level: number;
  rank: number;
  updatedAt: number;
}

function sorted(): EnhanceRow[] {
  return [...players.values()].sort((a, b) => b.level - a.level || a.updatedAt - b.updatedAt);
}

export function topRankings(limit = 10): RankRow[] {
  return sorted()
    .slice(0, limit)
    .map((r, i) => ({ nickname: r.nickname, level: r.level, rank: i + 1, updatedAt: r.updatedAt }));
}

export function myRanking(nickname: string): RankRow | null {
  const n = norm(nickname);
  const list = sorted();
  const idx = list.findIndex((r) => norm(r.nickname) === n);
  if (idx === -1) return null;
  return { nickname: list[idx].nickname, level: list[idx].level, rank: idx + 1, updatedAt: list[idx].updatedAt };
}
