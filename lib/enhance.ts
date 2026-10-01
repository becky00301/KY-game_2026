/**
 * "강화" 미니게임 — 기기별 개인 재화(염원의 빛/데이터로그)로 노아는 아리아의 옥을,
 * 연은 리버티 오브 페더를 0~30단계까지 강화한다. 두 팀은 서로 다른 아이템을 강화하는
 * 별개의 게임이지만 확률·비용 테이블은 공용이다.
 *
 * 1~15단계는 실패해도 그 자리에 머문다(파괴 없음). 16~30단계부터는 실패의 일부가
 * "파괴"로 갈라져서, 파괴되면 재화만 날리는 게 아니라 0단계로 완전히 초기화된다.
 * 성공/실패/파괴 세 확률의 합은 항상 100%다 — ENHANCE_DATA가 그 절대값을 그대로 담는다.
 */

import type { TeamId } from "./game";

/** 팀별 강화 대상 아이템 — 이름과 일러스트. */
export const ENHANCE_ITEM: Record<TeamId, { name: string; image: string }> = {
  ku: { name: "아리아의 옥", image: "/images/enhance/yeouiboju.webp" },
  yu: { name: "리버티 오브 페더", image: "/images/enhance/liberty-of-feather.webp" },
};

export const ENHANCE_MAX_LEVEL = 30;
/** 이 단계부터 실패 시 파괴 판정이 섞여 들어간다(0-index 기준 — "16단계" 시도). */
export const ENHANCE_DESTROY_FROM_LEVEL = 15;
/** 이 단계 이상으로 성공할 때마다 전체 공지급으로 화면 최상단에 웅장하게 알려준다. */
export const ENHANCE_ANNOUNCE_FROM_LEVEL = 23;
/** 기기별 현재 강화 단계 캐시 키(팀 접미사 붙여서 사용) — Enhance.tsx가 쓰고,
 *  GameScreen.tsx가 터치 점수·개인 재화 배율을 계산할 때 읽기 전용으로 같이 참조한다. */
export const ENHANCE_LEVEL_CACHE_KEY = "kyg.enhanceLevel";
/** 기기별 강화 닉네임 캐시 키(팀 접미사 붙여서 사용) — Enhance.tsx가 쓰고,
 *  GameScreen.tsx가 전체 초기화 때 같이 지운다. */
export const ENHANCE_NICKNAME_CACHE_KEY = "kyg.enhanceNickname";

/**
 * 터치 1회당 쌓이는 개인 재화(염원의 빛/데이터로그)의 기준량 — 실제로는 여기에
 * enhanceCurrencyMultiplier(강화 단계가 오를수록 커지는 배율)가 곱해져서 지급된다.
 * 처음엔 하루 10분 플레이로 22단계 기댓값 정도를 모으게 잡았더니(10,000/타) 너무
 * 쉽게 쌓여서, 1/6로 줄였다. 10분(초당 5회 × 600초 = 3,000타) 플레이 시 0단계
 * 기준으로 약 500만 정도가 쌓인다(강화할수록 더 빨리 쌓인다).
 */
export const PERSONAL_CURRENCY_PER_TAP = 1_667;

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

/** 0단계부터 level단계까지, 구간별로 다른 레벨당 보너스(%)를 전부 더한 값(전부 더하는
 *  방식 — 복리 아님). 기기별 추가 점수·개인 재화 배율이 공통으로 쓰는 누적 계산. */
function cumulativeBonusPercent(level: number, levelBonusPercent: (level: number) => number): number {
  const clamped = Math.max(0, Math.min(ENHANCE_MAX_LEVEL, level));
  let total = 0;
  for (let lv = 1; lv <= clamped; lv++) total += levelBonusPercent(lv);
  return total;
}

/**
 * "기기별 터치 점수" 배율 — 강화 단계가 오를수록 터치 한 번당 쌓이는 개인 점수가 커진다.
 * 공동 칼의 점수·재화(energy/lifetime)에는 전혀 영향을 주지 않는, 순수하게 이 기기에만
 * 쌓이는 보너스다. 레벨 1단계마다 붙는 보너스(%)가 구간별로 달라진다 — 16단계까지는
 * 1%씩, 17~19단계는 3%씩, 20~22단계는 8%씩, 23~24단계는 20%씩, 25단계부터는 50%씩
 * 누적된다.
 */
function enhanceScoreLevelBonusPercent(level: number): number {
  if (level <= 16) return 1;
  if (level <= 19) return 3;
  if (level <= 22) return 8;
  if (level <= 24) return 20;
  return 50;
}

/** 0단계부터 level단계까지 레벨당 보너스(%)를 전부 더한 값. */
export function enhanceScoreBonusPercent(level: number): number {
  return cumulativeBonusPercent(level, enhanceScoreLevelBonusPercent);
}

/** 터치 1회당 "기기별 추가 점수"에 곱해지는 배율 — 0단계면 1.0(보너스 없음). */
export function enhanceScoreMultiplier(level: number): number {
  return 1 + enhanceScoreBonusPercent(level) / 100;
}

/**
 * 개인 재화(염원의 빛/데이터로그) 배율 — 강화 단계가 오를수록 터치 한 번당 쌓이는
 * 재화도 더 빨리 늘어난다(강화할수록 다음 강화 재료를 더 빨리 모으는 선순환). 레벨
 * 1단계마다 붙는 보너스(%)가 구간별로 달라진다 — 0~12단계는 2.5%씩, 13~15단계는
 * 5%씩, 16~17단계는 10%씩, 18~19단계는 30%씩, 20~22단계는 60%씩, 23~25단계는
 * 150%씩, 26~30단계는 500%씩 누적된다.
 */
function enhanceCurrencyLevelBonusPercent(level: number): number {
  if (level <= 12) return 2.5;
  if (level <= 15) return 5;
  if (level <= 17) return 10;
  if (level <= 19) return 30;
  if (level <= 22) return 60;
  if (level <= 25) return 150;
  return 500;
}

/** 0단계부터 level단계까지 레벨당 재화 보너스(%)를 전부 더한 값. */
export function enhanceCurrencyBonusPercent(level: number): number {
  return cumulativeBonusPercent(level, enhanceCurrencyLevelBonusPercent);
}

/** 터치 1회당 개인 재화에 곱해지는 배율 — 0단계면 1.0(보너스 없음). */
export function enhanceCurrencyMultiplier(level: number): number {
  return 1 + enhanceCurrencyBonusPercent(level) / 100;
}
