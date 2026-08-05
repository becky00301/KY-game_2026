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
  windowStart: number;
  taps: number;
}

// 개발 중 Next.js가 모듈을 다시 불러와도 상태가 날아가지 않도록 globalThis에 붙인다.
const globalStore = globalThis as unknown as {
  __kygSwords?: Map<TeamId, SwordState>;
  __kygBudgets?: Map<string, Budget>;
};

const swords = (globalStore.__kygSwords ??= new Map<TeamId, SwordState>());
const budgets = (globalStore.__kygBudgets ??= new Map<string, Budget>());

export function getSword(team: TeamId): SwordState {
  let state = swords.get(team);
  if (!state) {
    state = createSword(team);
    swords.set(team, state);
  }
  const next = accrue(state);
  swords.set(team, next);
  return next;
}

/** 기기별 초당 터치 상한을 적용해 실제로 인정할 터치 수를 돌려준다. */
function allowTaps(clientId: string, requested: number): number {
  const now = Date.now();
  const capped = Math.max(0, Math.min(requested, MAX_TAPS_PER_FLUSH));
  const budget = budgets.get(clientId);

  if (!budget || now - budget.windowStart >= 1000) {
    const granted = Math.min(capped, MAX_TAPS_PER_SECOND);
    budgets.set(clientId, { windowStart: now, taps: granted });
    return granted;
  }

  const room = Math.max(0, MAX_TAPS_PER_SECOND - budget.taps);
  const granted = Math.min(capped, room);
  budget.taps += granted;
  return granted;
}

export function tapSword(
  team: TeamId,
  taps: number,
  elapsedSeconds: number,
  clientId: string
): SwordState {
  const granted = allowTaps(clientId, taps);
  const next = applyTaps(getSword(team), granted, elapsedSeconds);
  swords.set(team, next);
  return next;
}

export function buySwordUpgrade(team: TeamId, id: string) {
  const outcome = engineBuy(getSword(team), id);
  swords.set(team, outcome.state);
  return outcome;
}
