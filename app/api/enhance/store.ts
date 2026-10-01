/**
 * 개발용 로컬 백엔드의 저장소 — "강화" 미니게임의 기기별 진행도 + 랭킹.
 *
 * app/api/boss-ranking/store.ts와 같은 이유로 프로세스 메모리에 둔다. 운영에서는
 * 반드시 Supabase(enhance_* RPC)를 쓴다. 노아·연은 서로 다른 아이템을 강화하는
 * 별개의 게임이라, 기기 하나가 팀별로 각각 한 자리씩 가질 수 있고(키가 deviceId+team
 * 복합값) 닉네임도 같은 팀 안에서만 유일하다.
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

function key(deviceId: string, team: string): string {
  return `${deviceId}:${team}`;
}

function norm(nickname: string): string {
  return nickname.trim().toLowerCase();
}

function isNicknameTaken(nickname: string, team: string): boolean {
  const n = norm(nickname);
  for (const row of players.values()) {
    if (row.team === team && norm(row.nickname) === n) return true;
  }
  return false;
}

export function isNicknameAvailable(nickname: string, team: string): boolean {
  const n = norm(nickname);
  if (!n) return false;
  return !isNicknameTaken(nickname, team);
}

export function getByDevice(deviceId: string, team: string): EnhanceRow | null {
  return players.get(key(deviceId, team)) ?? null;
}

/** 팀 상관없이 이 기기의 강화 등록 — 한 기기는 한 진영에서만 등록할 수 있으므로 있어도 하나뿐이다. */
export function getByDeviceAnyTeam(deviceId: string): EnhanceRow | null {
  for (const row of players.values()) {
    if (row.deviceId === deviceId) return row;
  }
  return null;
}

/** 이 기기가 (다른 팀이든 무엇이든) 이미 강화 자리를 하나라도 갖고 있는지 — 반대 진영 등록 차단용. */
function isRegisteredElsewhere(deviceId: string, team: string): boolean {
  for (const row of players.values()) {
    if (row.deviceId === deviceId && row.team !== team) return true;
  }
  return false;
}

export interface RegisterOutcome {
  ok: boolean;
  reason?: "invalid" | "taken" | "other_team_registered";
  nickname?: string;
  level?: number;
}

/**
 * 이 기기가 이 팀으로 이미 등록돼 있으면 새 닉네임은 무시하고 기존 기록을 돌려준다.
 * 한 기기는 노아·연 둘 중 한 진영에서만 강화할 수 있다 — 반대 진영에 이미 등록돼
 * 있으면 'other_team_registered'로 막는다.
 */
export function register(nickname: string, deviceId: string, team: string): RegisterOutcome {
  const existing = players.get(key(deviceId, team));
  if (existing) {
    return { ok: true, nickname: existing.nickname, level: existing.level };
  }
  if (isRegisteredElsewhere(deviceId, team)) {
    return { ok: false, reason: "other_team_registered" };
  }
  const trimmed = nickname.trim();
  if (trimmed.length < 1 || trimmed.length > NICKNAME_MAX_LEN) {
    return { ok: false, reason: "invalid" };
  }
  if (isNicknameTaken(trimmed, team)) {
    return { ok: false, reason: "taken" };
  }
  players.set(key(deviceId, team), { deviceId, team, nickname: trimmed, level: 0, updatedAt: Date.now() });
  return { ok: true, nickname: trimmed, level: 0 };
}

export interface ReportOutcome {
  ok: boolean;
  level?: number;
}

/** 보낸 값을 그대로 반영한다 — 파괴로 0단계까지 내려가는 것도 정상적인 상태 변화다. */
export function reportLevel(deviceId: string, team: string, level: number): ReportOutcome {
  const row = players.get(key(deviceId, team));
  if (!row) return { ok: false };
  row.level = Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)));
  row.updatedAt = Date.now();
  return { ok: true, level: row.level };
}

export interface RankRow {
  nickname: string;
  level: number;
  rank: number;
  updatedAt: number;
}

function sortedFor(team: string): EnhanceRow[] {
  return [...players.values()]
    .filter((r) => r.team === team)
    .sort((a, b) => b.level - a.level || a.updatedAt - b.updatedAt);
}

export function topRankings(team: string, limit = 10): RankRow[] {
  return sortedFor(team)
    .slice(0, limit)
    .map((r, i) => ({ nickname: r.nickname, level: r.level, rank: i + 1, updatedAt: r.updatedAt }));
}

export function myRanking(nickname: string, team: string): RankRow | null {
  const n = norm(nickname);
  const list = sortedFor(team);
  const idx = list.findIndex((r) => norm(r.nickname) === n);
  if (idx === -1) return null;
  return { nickname: list[idx].nickname, level: list[idx].level, rank: idx + 1, updatedAt: list[idx].updatedAt };
}
