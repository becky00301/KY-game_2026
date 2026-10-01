/**
 * "랭킹 채팅" — "장비 강화"에 닉네임을 등록한 사람들끼리만 보낼 수 있는 전체 채팅.
 * 강화 단계가 높은 사람의 말풍선에는 단계 구간별로 다른 오오라 연출을 준다.
 */

import type { TeamId } from "./game";

export const CHAT_TEXT_MAX = 80;
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
