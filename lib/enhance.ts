/**
 * "강화" 미니게임 — 기기별 개인 재화(염원의 빛/데이터로그)로 아리아의 옥을
 * 0~30단계까지 강화한다.
 *
 * 1~15단계는 실패해도 그 자리에 머문다(파괴 없음). 16~30단계부터는 실패의 일부가
 * "파괴"로 갈라져서, 파괴되면 재화만 날리는 게 아니라 0단계로 완전히 초기화된다.
 * 성공/실패/파괴 세 확률의 합은 항상 100%다 — ENHANCE_DATA가 그 절대값을 그대로 담는다.
 */

import type { TeamId } from "./game";

export const ENHANCE_MAX_LEVEL = 30;
/** 이 단계부터 실패 시 파괴 판정이 섞여 들어간다(0-index 기준 — "16단계" 시도). */
export const ENHANCE_DESTROY_FROM_LEVEL = 15;

export interface EnhanceLevelData {
  /** 이 단계에서 1단계 강화를 시도하는 데 드는 비용. */
  cost: number;
  /** 성공 확률(0~1). */
  successRate: number;
  /** 파괴 확률(0~1) — 1~15단계는 항상 0. 실패 확률은 1 - successRate - destroyRate로 계산한다. */
  destroyRate: number;
}

/** index 0 = "1단계"(0→1 시도) ... index 29 = "30단계"(29→30 시도). 전부 실측 데이터. */
const ENHANCE_DATA: EnhanceLevelData[] = [
  { cost: 143, successRate: 0.95, destroyRate: 0 },
  { cost: 285, successRate: 0.9, destroyRate: 0 },
  { cost: 425, successRate: 0.85, destroyRate: 0 },
  { cost: 563, successRate: 0.8, destroyRate: 0 },
  { cost: 700, successRate: 0.75, destroyRate: 0 },
  { cost: 835, successRate: 0.7, destroyRate: 0 },
  { cost: 969, successRate: 0.65, destroyRate: 0 },
  { cost: 1101, successRate: 0.6, destroyRate: 0 },
  { cost: 1231, successRate: 0.55, destroyRate: 0 },
  { cost: 1360, successRate: 0.5, destroyRate: 0 },
  { cost: 1487, successRate: 0.45, destroyRate: 0 },
  { cost: 1613, successRate: 0.4, destroyRate: 0 },
  { cost: 1737, successRate: 0.35, destroyRate: 0 },
  { cost: 1859, successRate: 0.3, destroyRate: 0 },
  { cost: 1980, successRate: 0.3, destroyRate: 0 },
  { cost: 67008, successRate: 0.3, destroyRate: 0.0205 },
  { cost: 74908, successRate: 0.3, destroyRate: 0.0205 },
  { cost: 166416, successRate: 0.15, destroyRate: 0.0674 },
  { cost: 183816, successRate: 0.15, destroyRate: 0.08425 },
  { cost: 101008, successRate: 0.3, destroyRate: 0.10275 },
  { cost: 221016, successRate: 0.15, destroyRate: 0.1264 },
  { cost: 240816, successRate: 0.15, destroyRate: 0.1685 },
  { cost: 130708, successRate: 0.1, destroyRate: 0.179 },
  { cost: 141408, successRate: 0.1, destroyRate: 0.179 },
  { cost: 152508, successRate: 0.1, destroyRate: 0.179 },
  { cost: 164008, successRate: 0.07, destroyRate: 0.1853 },
  { cost: 175908, successRate: 0.05, destroyRate: 0.1895 },
  { cost: 188208, successRate: 0.03, destroyRate: 0.1937 },
  { cost: 200908, successRate: 0.01, destroyRate: 0.1979 },
  { cost: 214008, successRate: 0.01, destroyRate: 0.1979 },
];

function dataOf(level: number): EnhanceLevelData | null {
  if (level < 0 || level >= ENHANCE_MAX_LEVEL) return null;
  return ENHANCE_DATA[level];
}

/** level → level+1로 강화하는 데 필요한 비용. 이미 최대 단계면 null. */
export function enhanceCost(level: number): number | null {
  return dataOf(level)?.cost ?? null;
}

/** level → level+1 강화 성공확률(0~1). 이미 최대 단계면 null. */
export function enhanceSuccessRate(level: number): number | null {
  return dataOf(level)?.successRate ?? null;
}

/** level에서 실패할 때 그중 파괴로 갈라지는 확률(0~1) — 1~15단계는 0. */
export function enhanceDestroyRate(level: number): number | null {
  return dataOf(level)?.destroyRate ?? null;
}

export type EnhanceOutcome = "success" | "fail" | "destroy";

/** 성공/실패/파괴 세 확률의 합을 100%로 보고 한 번에 굴린다. */
export function rollEnhanceOutcome(level: number): EnhanceOutcome {
  const data = dataOf(level);
  if (!data) return "fail";
  const roll = Math.random();
  if (roll < data.successRate) return "success";
  if (roll < data.successRate + data.destroyRate) return "destroy";
  return "fail";
}

export interface EnhanceTableRow {
  level: number;
  cost: number;
  successRate: number;
  destroyRate: number;
}

/** 확률표 UI용 — 0→1부터 29→30까지 전체 단계. */
export function enhanceTable(): EnhanceTableRow[] {
  return ENHANCE_DATA.map((data, level) => ({ level, ...data }));
}

/** 팀별로 강화 기능이 열려 있는지 — 지금은 노아만, 연은 준비중. */
export function enhanceEnabledFor(team: TeamId): boolean {
  return team === "ku";
}
