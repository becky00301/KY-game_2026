"use client";

import { RankingChatMessage } from "@/lib/backend";
import { CHAT_RANK_TOP1_TITLE, chatRankBadge } from "@/lib/chat";

/**
 * 보스전 입장 버튼 옆에 붙는 한 줄짜리 채팅 티커 — 평소엔 이 한 줄만 보이고, 새 메시지가
 * 오면 이 한 줄이 그대로 바뀐다(쌓이지 않는다). 눌러야 ChatSheet(전체 채팅창)가 열린다.
 * bossTopRanks는 "닉네임(소문자) → 서휘령 랭킹모드 순위" — TOP10/TOP1 배지 표시용.
 */
export function ChatTicker({
  latest,
  bossTopRanks,
  onOpen,
}: {
  latest: RankingChatMessage | null;
  bossTopRanks: Record<string, number>;
  onOpen: () => void;
}) {
  const rank = latest ? bossTopRanks[latest.nickname.toLowerCase()] ?? null : null;
  const rankBadge = chatRankBadge(rank);
  return (
    <button className="chat-ticker" onClick={onOpen} aria-label="랭킹 채팅 열기">
      <span className="chat-ticker-icon" aria-hidden="true">
        💬
      </span>
      {latest ? (
        <span key={latest.id} className="chat-ticker-text">
          <strong className="chat-ticker-name">{latest.nickname}</strong>
          {latest.enhanceLevel > 0 && <span className="chat-ticker-level">{latest.enhanceLevel}강</span>}
          {rankBadge && (
            <span className={`chat-ticker-rank ${rank === 1 ? "chat-ticker-rank--top1" : ""}`}>{rankBadge}</span>
          )}
          {rank === 1 && <span className="chat-ticker-rank-title">{CHAT_RANK_TOP1_TITLE}</span>}
          <span className="chat-ticker-sep">:</span> {latest.text}
        </span>
      ) : (
        <span className="chat-ticker-text chat-ticker-placeholder">눌러서 채팅 참여하기</span>
      )}
    </button>
  );
}
