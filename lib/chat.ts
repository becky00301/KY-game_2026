/**
 * "랭킹 채팅" — 서휘령 보스전 랭킹모드에 닉네임을 등록한 사람들끼리만 보낼 수 있는
 * 전체 채팅. 강화 단계가 높은 사람의 말풍선에는 단계 구간별로 다른 오오라 연출을 준다.
 */

import type { TeamId } from "./game";

export const CHAT_TEXT_MAX = 80;
/** 평소(접은) 상태에서 보스전 입장 버튼 옆에 보여줄 한 줄 티커가 유지하는 최근 메시지 수. */
export const CHAT_HISTORY_LIMIT = 50;

/** 강화 말풍선 오오라 구간 — 이 단계부터 번쩍이기 시작한다. */
export const CHAT_AURA_FROM_LEVEL = 22;

/**
 * 강화 단계·팀에 따른 말풍선 오오라 CSS 클래스. 22단계는 양 팀 공통 노란빛, 23단계부터는
 * 팀 색(노아=빨강/연=파랑), 24단계부터는 팀 색의 검은 번개로 더 강해진다. 22단계 미만이면
 * null(오오라 없음).
 */
export function chatAuraClass(team: TeamId, level: number): string | null {
  if (level >= 24) return `chat-aura-24-${team}`;
  if (level === 23) return `chat-aura-23-${team}`;
  if (level === 22) return "chat-aura-22";
  return null;
}
