/**
 * 공동 칼의 게임 수학.
 *
 * 이 파일은 두 곳에서 쓰인다.
 *   1. 클라이언트 — 터치 즉시 보여줄 낙관적 예측값 계산
 *   2. 개발용 로컬 백엔드(app/api/sword) — 실제 상태 갱신
 *
 * 운영에서 최종 권위는 Supabase의 SQL 함수다(supabase/schema.sql).
 * 여기 수치를 바꾸면 schema.sql의 seed도 같이 바꿔야 한다.
 */

import { TeamId } from "./game";

/** 서버가 들고 있는 팀별 공동 칼 상태 */
export interface SwordState {
  team: TeamId;
  energy: number; // 공동 보유 기운 (강화에 쓰면 줄어든다)
  lifetime: number; // 누적 획득 기운 — 진화 기준
  taps: number; // 전체 참여자의 누적 터치 횟수
  tapLevels: Record<string, number>;
  autoLevels: Record<string, number>;
  feverGauge: number; // 팀 공동 응원 열기 게이지
  feverUntil: number; // 응원 열기 종료 시각 (ms epoch, 0이면 비활성)
  updatedAt: number; // 마지막 정산 시각 (ms epoch)
}

// ---------- 튜닝 수치 ----------

/** 누적 기운 기준 진화 임계값. 학교 전체가 함께 올리므로 개인용보다 훨씬 크다. */
export const STAGE_THRESHOLDS = [
  0,
  50_000,
  500_000,
  4_000_000,
  30_000_000,
  200_000_000,
  1_500_000_000,
];

export const STAGE_GROWTH = 1.5;

/** 한 번의 전송으로 인정하는 최대 터치 수 */
export const MAX_TAPS_PER_FLUSH = 40;
/** 한 기기가 초당 인정받는 최대 터치 수 */
export const MAX_TAPS_PER_SECOND = 20;
/** 자동 응원을 소급 정산해 주는 최대 시간(초) */
export const MAX_ACCRUAL_SECONDS = 120;

/** 응원 열기 */
export const FEVER_MAX = 3_000; // 팀 전체가 함께 채운다
export const FEVER_DURATION_MS = 10_000;
export const FEVER_MULTIPLIER = 3;

/** 연타 보너스 상한 (초당 20회에서 1.4배) */
export const RATE_BONUS_PER_TAP = 0.02;
export const RATE_BONUS_CAP = 20;

export interface UpgradeNumbers {
  id: string;
  kind: "tap" | "auto";
  baseCost: number;
  growth: number;
  power: number;
}

/** 강화 수치. 이름·아이콘은 lib/upgrades.ts에 따로 있다. */
export const UPGRADE_NUMBERS: UpgradeNumbers[] = [
  { id: "wrist", kind: "tap", baseCost: 2_000, growth: 1.14, power: 1 },
  { id: "stick", kind: "tap", baseCost: 40_000, growth: 1.15, power: 8 },
  { id: "glove", kind: "tap", baseCost: 600_000, growth: 1.16, power: 55 },
  { id: "beast", kind: "tap", baseCost: 9_000_000, growth: 1.17, power: 400 },
  { id: "fresh", kind: "auto", baseCost: 5_000, growth: 1.14, power: 3 },
  { id: "dept", kind: "auto", baseCost: 70_000, growth: 1.15, power: 25 },
  { id: "band", kind: "auto", baseCost: 900_000, growth: 1.15, power: 180 },
  { id: "senior", kind: "auto", baseCost: 12_000_000, growth: 1.16, power: 1_300 },
  { id: "choir", kind: "auto", baseCost: 150_000_000, growth: 1.17, power: 9_000 },
];

const BY_ID = new Map(UPGRADE_NUMBERS.map((u) => [u.id, u]));

// ---------- 파생 계산 ----------

export function stageOf(lifetime: number) {
  let stage = 0;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (lifetime >= STAGE_THRESHOLDS[i]) stage = i;
  }
  return stage;
}

export function stageMultiplier(stage: number) {
  return Math.pow(STAGE_GROWTH, stage);
}

/** 최종 단계 이후 별 등급 — 누적 기운이 4배가 될 때마다 하나씩 */
export function starRank(lifetime: number) {
  const last = STAGE_THRESHOLDS[STAGE_THRESHOLDS.length - 1];
  if (lifetime < last) return 0;
  return Math.floor(Math.log(lifetime / last) / Math.log(4));
}

export function stageProgress(lifetime: number) {
  const stage = stageOf(lifetime);
  const isMax = stage >= STAGE_THRESHOLDS.length - 1;
  if (isMax) {
    const last = STAGE_THRESHOLDS[STAGE_THRESHOLDS.length - 1];
    const rank = starRank(lifetime);
    const from = last * Math.pow(4, rank);
    const to = last * Math.pow(4, rank + 1);
    return { stage, isMax, from, to, ratio: (lifetime - from) / (to - from) };
  }
  const from = STAGE_THRESHOLDS[stage];
  const to = STAGE_THRESHOLDS[stage + 1];
  return { stage, isMax, from, to, ratio: (lifetime - from) / (to - from) };
}

export function tapPower(state: SwordState) {
  let power = 1;
  for (const def of UPGRADE_NUMBERS) {
    if (def.kind !== "tap") continue;
    power += (state.tapLevels[def.id] ?? 0) * def.power;
  }
  return power * stageMultiplier(stageOf(state.lifetime));
}

export function autoPerSecond(state: SwordState) {
  let rate = 0;
  for (const def of UPGRADE_NUMBERS) {
    if (def.kind !== "auto") continue;
    rate += (state.autoLevels[def.id] ?? 0) * def.power;
  }
  return rate * stageMultiplier(stageOf(state.lifetime));
}

export function upgradeCost(id: string, level: number) {
  const def = BY_ID.get(id);
  if (!def) return Infinity;
  return Math.ceil(def.baseCost * Math.pow(def.growth, level));
}

export function levelOf(state: SwordState, id: string) {
  const def = BY_ID.get(id);
  if (!def) return 0;
  return (def.kind === "tap" ? state.tapLevels : state.autoLevels)[id] ?? 0;
}

export function isFeverActive(state: SwordState, now = Date.now()) {
  return state.feverUntil > now;
}

/**
 * 연타 보너스. 클라이언트가 콤보 숫자를 보내는 대신
 * 서버가 실제 터치 속도로 직접 계산해 조작을 막는다.
 */
export function rateBonus(taps: number, elapsedSeconds: number) {
  const rate = taps / Math.max(elapsedSeconds, 0.5);
  return 1 + Math.min(rate, RATE_BONUS_CAP) * RATE_BONUS_PER_TAP;
}

// ---------- 상태 전이 ----------

/** 마지막 정산 이후 흐른 시간만큼 자동 응원을 반영한다. */
export function accrue(state: SwordState, now = Date.now()): SwordState {
  const elapsed = Math.min(Math.max(now - state.updatedAt, 0) / 1000, MAX_ACCRUAL_SECONDS);
  if (elapsed <= 0) return { ...state, updatedAt: now };
  const mult = isFeverActive(state, now) ? FEVER_MULTIPLIER : 1;
  const gain = autoPerSecond(state) * elapsed * mult;
  return {
    ...state,
    energy: state.energy + gain,
    lifetime: state.lifetime + gain,
    updatedAt: now,
  };
}

/**
 * 터치 묶음을 반영한다. taps는 호출 측에서 이미 상한을 적용한 값이어야 한다.
 * elapsedSeconds는 그 터치들이 실제로 벌어진 시간.
 */
export function applyTaps(
  state: SwordState,
  taps: number,
  elapsedSeconds: number,
  now = Date.now()
): SwordState {
  const next = accrue(state, now);
  if (taps <= 0) return next;

  const mult = isFeverActive(next, now) ? FEVER_MULTIPLIER : 1;
  const gain = tapPower(next) * taps * rateBonus(taps, elapsedSeconds) * mult;

  let feverGauge = next.feverGauge;
  let feverUntil = next.feverUntil;
  // 응원 열기는 팀 전체가 함께 채우고, 차는 순간 모두에게 발동한다.
  if (feverUntil <= now) {
    feverGauge += taps;
    if (feverGauge >= FEVER_MAX) {
      feverGauge = 0;
      feverUntil = now + FEVER_DURATION_MS;
    }
  }

  return {
    ...next,
    energy: next.energy + gain,
    lifetime: next.lifetime + gain,
    taps: next.taps + taps,
    feverGauge,
    feverUntil,
  };
}

export type BuyResult =
  | { ok: true; state: SwordState; cost: number }
  | { ok: false; reason: "unknown-upgrade" | "insufficient"; state: SwordState };

/** 공동 기운으로 강화를 산다. 누구나 살 수 있다. */
export function buyUpgrade(state: SwordState, id: string, now = Date.now()): BuyResult {
  const def = BY_ID.get(id);
  if (!def) return { ok: false, reason: "unknown-upgrade", state };

  const next = accrue(state, now);
  const level = levelOf(next, id);
  const cost = upgradeCost(id, level);
  if (next.energy < cost) return { ok: false, reason: "insufficient", state: next };

  const key = def.kind === "tap" ? "tapLevels" : "autoLevels";
  return {
    ok: true,
    cost,
    state: {
      ...next,
      energy: next.energy - cost,
      [key]: { ...next[key], [id]: level + 1 },
    },
  };
}

export function createSword(team: TeamId, now = Date.now()): SwordState {
  return {
    team,
    energy: 0,
    lifetime: 0,
    taps: 0,
    tapLevels: {},
    autoLevels: {},
    feverGauge: 0,
    feverUntil: 0,
    updatedAt: now,
  };
}
