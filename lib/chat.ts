/**
 * "랭킹 채팅" — "장비 강화"에 닉네임을 등록한 사람들끼리만 보낼 수 있는 전체 채팅.
 * 강화 단계가 높은 사람의 말풍선에는 단계 구간별로 다른 오오라 연출을 준다.
 */

import type { TeamId } from "./game";

export const CHAT_TEXT_MAX = 49;
/** 평소(접은) 상태에서 보스전 입장 버튼 옆에 보여줄 한 줄 티커가 유지하는 최근 메시지 수. */
export const CHAT_HISTORY_LIMIT = 50;

/**
 * 도배 방지 — 같은 기기가 이 시간(ms) 안에 이 횟수만큼 이미 보냈으면 다음 전송을 막는다.
 * 서버(ranking_chat_send RPC)가 최종적으로 강제하는 값과 맞춰둔 클라이언트 쪽 사본 —
 * 여기서 먼저 막아 왕복 없이 바로 안내하고, 실제 차단은 서버가 한다.
 */
export const CHAT_RATE_LIMIT_WINDOW_MS = 5_000;
export const CHAT_RATE_LIMIT_MAX = 3;

/** 강화 말풍선 오오라 구간 — 이 단계부터 번쩍이기 시작한다(1단계: 노란빛). */
export const CHAT_AURA_FROM_LEVEL = 20;

/**
 * 강화 단계·팀에 따른 말풍선 오오라 CSS 클래스 — 3단계로 세진다.
 * 20~21단계: 양 팀 공통 노란빛. 22단계: 팀 색(노아=빨강/연=파랑) 펄스.
 * 23단계 이상: 팀 색의 검은 번개(가장 강한 연출). 20단계 미만이면 null(오오라 없음).
 */
export function chatAuraClass(team: TeamId, level: number): string | null {
  if (level >= 23) return `chat-aura-tier3-${team}`;
  if (level === 22) return `chat-aura-tier2-${team}`;
  if (level >= 20) return "chat-aura-tier1";
  return null;
}

/**
 * 서휘령 랭킹모드 TOP10/TOP1 오오라 — 강화 단계 오오라보다 우선한다(23강 이상이어도
 * 이 오오라에 가려지지 않는다). rank는 boss_ranking_top(10)에서 닉네임으로 찾은
 * 순위(1~10), 순위 밖이면 null. 1위(최초 격파자)는 TOP10보다 훨씬 화려한 별도 연출.
 */
export function chatRankAuraClass(rank: number | null): string | null {
  if (rank === 1) return "chat-aura-top1";
  if (rank !== null && rank <= 10) return "chat-aura-top10";
  return null;
}

/** 닉네임 옆에 붙는 서휘령 랭킹 배지 문구. */
export function chatRankBadge(rank: number | null): string | null {
  if (rank === 1) return "서휘령TOP1";
  if (rank !== null && rank <= 10) return "서휘령TOP10";
  return null;
}

/** TOP1(최초 격파자) 전용 — 랭킹 배지 옆에 추가로 붙는 칭호. */
export const CHAT_RANK_TOP1_TITLE = "악귀멸살";
