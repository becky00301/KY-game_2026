/**
 * "강화" 미니게임 — 기기별 개인 재화(염원의 빛/데이터로그)로 노아는 아리아의 옥을,
 * 연은 리버티 오브 페더를 0~30단계까지 강화한다. 두 팀은 서로 다른 아이템을 강화하는
 * 별개의 게임이지만 확률·비용 테이블은 공용이다.
 *
 * 1~15단계는 실패해도 그 자리에 머문다(파괴 없음). 16~30단계부터는 실패의 일부가
 * "파괴"로 갈라져서, 파괴되면 재화만 날리는 게 아니라 0단계로 완전히 초기화된다.
 * 성공/실패/파괴 세 확률의 합은 항상 100%다 — ENHANCE_DATA가 그 절대값을 그대로 담는다.
 *
 * 1~21단계 구간은 너무 가혹하다는 피드백을 받아 비용과 파괴확률을 원래 실측값의 70%로
 * 깎았다(파괴확률이 줄어든 만큼은 성공확률은 그대로 두고 실패확률로 넘어간다 — 파괴
 * 확률만 뺀 나머지를 실패로 계산하는 구조라 destroyRate만 줄이면 자동으로 그렇게 된다).
 * 22단계부터는 원래 실측값 그대로다.
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
/** 기기별 "역대 최고 강화 단계" 캐시 키(팀 접미사 붙여서 사용) — 파괴로 현재 단계가
 *  내려가도 이 값은 내려가지 않는다. 확정강화(아래 GUARANTEED_ENHANCE_*)의 해금
 *  조건으로 쓰인다. Enhance.tsx가 쓰고, GameScreen.tsx가 전체 초기화 때 같이 지운다. */
export const ENHANCE_MAX_LEVEL_CACHE_KEY = "kyg.enhanceMaxLevel";

/**
 * 터치 1회당 쌓이는 개인 재화(염원의 빛/데이터로그)의 기준량 — 실제로는 여기에
 * enhanceCurrencyMultiplier(강화 단계가 오를수록 커지는 배율)가 곱해져서 지급된다.
 * 처음엔 하루 10분 플레이로 22단계 기댓값 정도를 모으게 잡았더니(10,000/타) 너무
 * 쉽게 쌓여서 1/6로 줄였다가(1,667/타), 너무 적다는 피드백에 45% 늘렸다. 10분(초당
 * 5회 × 600초 = 3,000타) 플레이 시 0단계 기준으로 약 725만 정도가 쌓인다(강화할수록
 * 더 빨리 쌓인다).
 */
export const PERSONAL_CURRENCY_PER_TAP = 2_417;

/**
 * "확정강화" — 0단계부터 해당 단계까지 확률 없이 확정으로 올려주는 대신, 평균(기댓값)
 * 비용의 2배를 받는다. 파괴로 공들인 단계를 잃었을 때의 "보험"에 가까운 기능이라, 아무나
 * 바로 쓸 수 있게 하면 확률 자체의 의미가 없어진다 — 그래서 해당 단계보다 "한 단계 더
 * 위"까지 실제로 도달해본 적이 있어야만(=ENHANCE_MAX_LEVEL_CACHE_KEY 기준) 잠금이
 * 풀린다. 비용은 Markov 체인(파괴로 인한 0단계 리셋 포함)으로 계산한 기댓값의 2배를
 * 반올림한 값이다(1~21단계 70% 할인이 반영된 ENHANCE_DATA 기준) — 15단계: 기댓값
 * ≈26,024 → 비용 52,000 / 20단계: 기댓값 ≈3,474,177 → 비용 6,950,000 / 22단계:
 * 기댓값 ≈15,523,645 → 비용 31,000,000.
 */
export const GUARANTEED_ENHANCE_TARGETS = [15, 20, 22] as const;
export const GUARANTEED_ENHANCE_COST: Record<number, number> = {
  15: 52_000,
  20: 6_950_000,
  22: 31_000_000,
};

export interface EnhanceLevelData {
  /** 이 단계에서 1단계 강화를 시도하는 데 드는 비용. */
  cost: number;
  /** 성공 확률(0~1). */
  successRate: number;
  /** 파괴 확률(0~1) — 1~15단계는 항상 0. 실패 확률은 1 - successRate - destroyRate로 계산한다. */
  destroyRate: number;
}

/**
 * index 0 = "1단계"(0→1 시도) ... index 29 = "30단계"(29→30 시도). 실측 데이터에
 * 1~21단계(index 0~20) 70% 할인을 적용한 값 — 22단계(index 21)부터는 실측 그대로.
 */
const ENHANCE_DATA: EnhanceLevelData[] = [
  { cost: 100, successRate: 0.95, destroyRate: 0 },
  { cost: 200, successRate: 0.9, destroyRate: 0 },
  { cost: 298, successRate: 0.85, destroyRate: 0 },
  { cost: 394, successRate: 0.8, destroyRate: 0 },
  { cost: 490, successRate: 0.75, destroyRate: 0 },
  { cost: 584, successRate: 0.7, destroyRate: 0 },
  { cost: 678, successRate: 0.65, destroyRate: 0 },
  { cost: 771, successRate: 0.6, destroyRate: 0 },
  { cost: 862, successRate: 0.55, destroyRate: 0 },
  { cost: 952, successRate: 0.5, destroyRate: 0 },
  { cost: 1041, successRate: 0.45, destroyRate: 0 },
  { cost: 1129, successRate: 0.4, destroyRate: 0 },
  { cost: 1216, successRate: 0.35, destroyRate: 0 },
  { cost: 1301, successRate: 0.3, destroyRate: 0 },
  { cost: 1386, successRate: 0.3, destroyRate: 0 },
  { cost: 46906, successRate: 0.3, destroyRate: 0.01435 },
  { cost: 52436, successRate: 0.3, destroyRate: 0.01435 },
  { cost: 116491, successRate: 0.15, destroyRate: 0.04718 },
  { cost: 128671, successRate: 0.15, destroyRate: 0.058975 },
  { cost: 70706, successRate: 0.3, destroyRate: 0.071925 },
  { cost: 154711, successRate: 0.15, destroyRate: 0.08848 },
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
