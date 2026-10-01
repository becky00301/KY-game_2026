/**
 * "강화" 미니게임 — 기기별 개인 재화(염원의 빛/데이터로그)로 여의보주를
 * 0~30단계까지 강화한다. 비용·성공확률은 전부 임시값이다(실제 밸런스는
 * 나중에 따로 전달받아 조정 예정).
 */

import type { TeamId } from "./game";

export const ENHANCE_MAX_LEVEL = 30;

const ENHANCE_BASE_COST = 100;
const ENHANCE_COST_GROWTH = 1.35;
const ENHANCE_BASE_RATE = 0.95;
const ENHANCE_RATE_STEP = 0.03;
const ENHANCE_MIN_RATE = 0.05;

/** level → level+1로 강화하는 데 필요한 비용. 이미 최대 단계면 null. */
export function enhanceCost(level: number): number | null {
  if (level < 0 || level >= ENHANCE_MAX_LEVEL) return null;
  return Math.round(ENHANCE_BASE_COST * Math.pow(ENHANCE_COST_GROWTH, level));
}

/** level → level+1 강화 성공확률(0~1). 이미 최대 단계면 null. */
export function enhanceSuccessRate(level: number): number | null {
  if (level < 0 || level >= ENHANCE_MAX_LEVEL) return null;
  return Math.max(ENHANCE_MIN_RATE, ENHANCE_BASE_RATE - level * ENHANCE_RATE_STEP);
}

export interface EnhanceTableRow {
  level: number;
  cost: number;
  rate: number;
}

/** 확률표 UI용 — 0→1부터 29→30까지 전체 단계. */
export function enhanceTable(): EnhanceTableRow[] {
  return Array.from({ length: ENHANCE_MAX_LEVEL }, (_, level) => ({
    level,
    cost: enhanceCost(level)!,
    rate: enhanceSuccessRate(level)!,
  }));
}

/** 팀별로 강화 기능이 열려 있는지 — 지금은 노아만, 연은 준비중. */
export function enhanceEnabledFor(team: TeamId): boolean {
  return team === "ku";
}
