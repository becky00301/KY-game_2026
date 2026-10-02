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
 * 강화 단계·팀에 따른 말풍선 오오라 CSS 클래스 — 7단계로 세진다.
 * 20~21단계: 양 팀 공통 노란빛. 22단계: 팀 색(노아=빨강/연=파랑) 펄스.
 * 23단계: 팀 색의 검은 번개. 24단계부터는 팀 구분 없이(노아·연 동일) 더 화려해지는
 * 전용 연출 4단계 — 24: 황금빛, 25: 더 밝은 백금빛 스파클, 28: 회전하는 보랏빛 고리,
 * 30(만렙): 무지개로 빛나는 가장 화려한 연출. 20단계 미만이면 null(오오라 없음).
 */
export function chatAuraClass(team: TeamId, level: number): string | null {
  if (level >= 30) return "chat-aura-tier7";
  if (level >= 28) return "chat-aura-tier6";
  if (level >= 25) return "chat-aura-tier5";
  if (level >= 24) return "chat-aura-tier4";
  if (level >= 23) return `chat-aura-tier3-${team}`;
  if (level === 22) return `chat-aura-tier2-${team}`;
  if (level >= 20) return "chat-aura-tier1";
  return null;
}

/** 24단계 이상(노아·연 공통) 연출이 시작되는 기준 — hasChatAuraChoice가 이 값을 쓴다. */
export const CHAT_AURA_LEVEL_TIER_FROM = 24;

/**
 * 서휘령 랭킹모드 TOP10/TOP1 오오라 — 강화 단계 오오라보다 우선한다(기본값). rank는
 * boss_ranking_top(10)에서 닉네임으로 찾은 순위(1~10), 순위 밖이면 null. 1위(최초
 * 격파자)는 TOP10보다 훨씬 화려한 별도 연출.
 */
export function chatRankAuraClass(rank: number | null): string | null {
  if (rank === 1) return "chat-aura-top1";
  if (rank !== null && rank <= 10) return "chat-aura-top10";
  return null;
}

/**
 * 실제로 말풍선에 적용할 오오라를 정한다 — 서휘령 랭킹 오오라와 강화 24단계 이상
 * 오오라를 둘 다 가진 사람은 preference('rank'|'level'|null)로 고를 수 있다.
 * preference가 'level'이고 둘 다 있으면 강화 오오라를, 그 외(null·'rank', 또는 하나만
 * 있을 때)는 기존처럼 랭킹 오오라를 우선한다.
 */
export function resolveChatAura(
  team: TeamId,
  level: number,
  rank: number | null,
  preference?: string | null
): string | null {
  const rankAura = chatRankAuraClass(rank);
  const levelAura = chatAuraClass(team, level);
  if (rankAura && levelAura && preference === "level") return levelAura;
  return rankAura ?? levelAura;
}

/** 서휘령 랭킹 오오라와 강화 24단계 이상 오오라를 "둘 다" 가져서, 채팅창에서 어느 걸
 *  보여줄지 고를 수 있는 선택지가 의미 있는 경우인지. */
export function hasChatAuraChoice(rank: number | null, level: number): boolean {
  return chatRankAuraClass(rank) !== null && level >= CHAT_AURA_LEVEL_TIER_FROM;
}

/** 닉네임 옆에 붙는 서휘령 랭킹 배지 문구. */
export function chatRankBadge(rank: number | null): string | null {
  if (rank === 1) return "서휘령TOP1";
  if (rank !== null && rank <= 10) return "서휘령TOP10";
  return null;
}

/** TOP1(최초 격파자) 전용 — 랭킹 배지 옆에 추가로 붙는 칭호. */
export const CHAT_RANK_TOP1_TITLE = "악귀멸살";
