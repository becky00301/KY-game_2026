/**
 * 개발용 로컬 백엔드의 저장소.
 *
 * Supabase 자격증명이 없을 때만 쓴다. 프로세스 메모리에 들고 있으므로
 * 서버를 재시작하면 초기화되고, 서버리스(Vercel)에서는 인스턴스마다 달라져
 * 제대로 동작하지 않는다. 운영에서는 반드시 Supabase를 쓴다.
 */

import {
  MAX_TAPS_PER_FLUSH,
  MAX_TAPS_PER_SECOND,
  SwordState,
  applyTaps,
  accrue,
  buyUpgrade as engineBuy,
  createSword,
} from "@/lib/engine";
import { TeamId } from "@/lib/game";

interface Budget {
  tokens: number;
  refilledAt: number;
}

// 개발 중 Next.js가 모듈을 다시 불러와도 상태가 날아가지 않도록 globalThis에 붙인다.
const globalStore = globalThis as unknown as {
  __kygSwords?: Map<TeamId, SwordState>;
  __kygBudgets?: Map<string, Budget>;
  __kygPresence?: Map<string, number>;
};

const swords = (globalStore.__kygSwords ??= new Map<TeamId, SwordState>());
const budgets = (globalStore.__kygBudgets ??= new Map<string, Budget>());
/** `${team}:${clientId}` → 마지막 heartbeat 시각 */
const presence = (globalStore.__kygPresence ??= new Map<string, number>());

/** heartbeat가 이 시간 안에 들어온 기기만 접속 중으로 센다. */
const PRESENCE_TTL_MS = 15_000;

export function touchPresence(team: TeamId, clientId: string): number {
  const now = Date.now();
  presence.set(`${team}:${clientId}`, now);

  let online = 0;
  for (const [key, seen] of presence) {
    if (now - seen > PRESENCE_TTL_MS) {
      presence.delete(key);
    } else if (key.startsWith(`${team}:`)) {
      online++;
    }
  }
  return online;
}

/** 상태를 저장하면서 버전을 1 올린다 — Supabase의 swords.version과 같은 역할. */
function save(team: TeamId, state: SwordState): SwordState {
  const prev = swords.get(team);
  const next = { ...state, version: (prev?.version ?? 0) + 1 };
  swords.set(team, next);
  return next;
}

export function getSword(team: TeamId): SwordState {
  let state = swords.get(team);
  if (!state) {
    state = createSword(team);
    swords.set(team, state);
  }
  return save(team, accrue(state));
}

/**
 * 기기별 터치 상한을 적용해 실제로 인정할 터치 수를 돌려준다.
 * 토큰 통 방식 — schema.sql의 sword_allow_taps와 같은 규칙이다.
 */
function allowTaps(clientId: string, requested: number): number {
  const now = Date.now();
  const cap = Math.max(MAX_TAPS_PER_FLUSH, MAX_TAPS_PER_SECOND);
  const budget = budgets.get(clientId);
  const tokens = budget
    ? Math.min(cap, budget.tokens + (Math.max(now - budget.refilledAt, 0) / 1000) * MAX_TAPS_PER_SECOND)
    : cap;
  const granted = Math.max(0, Math.min(requested, Math.floor(tokens)));
  budgets.set(clientId, { tokens: tokens - granted, refilledAt: now });
  return granted;
}

export function tapSword(
  team: TeamId,
  taps: number,
  elapsedSeconds: number,
  clientId: string
): SwordState {
  const granted = allowTaps(clientId, taps);
  return save(team, applyTaps(getSword(team), granted, elapsedSeconds));
}

export function buySwordUpgrade(team: TeamId, id: string) {
  const outcome = engineBuy(getSword(team), id);
  return { ...outcome, state: save(team, outcome.state) };
}
