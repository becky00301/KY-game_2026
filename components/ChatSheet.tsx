"use client";

import { useEffect, useRef, useState } from "react";
import { RankingChatMessage, sendRankingChatMessage } from "@/lib/backend";
import {
  CHAT_RANK_TOP1_TITLE,
  CHAT_RATE_LIMIT_MAX,
  CHAT_RATE_LIMIT_WINDOW_MS,
  CHAT_TEXT_MAX,
  chatAuraClass,
  chatRankAuraClass,
  chatRankBadge,
} from "@/lib/chat";
import { TeamId } from "@/lib/game";
import { containsBannedWord } from "@/lib/profanity";

/**
 * 전체 화면으로 펼쳐지는 랭킹 채팅 — "장비 강화"에 닉네임을 등록한 사람들끼리만 보낼
 * 수 있다. 내가 보낸 메시지는 오른쪽, 남이 보낸 메시지는 왼쪽에 뜨는 일반적인 메신저
 * 말풍선 형태다. 20단계 이상 강화한 사람의 말풍선에는 단계별 오오라 연출이 붙는다
 * (lib/chat.ts의 chatAuraClass).
 *
 * 보낸 메시지를 여기서 바로 목록에 추가하지 않는다(shouts와 같은 이유) — Supabase
 * Realtime의 INSERT 이벤트는 "보낸 사람 본인"에게도 그대로 돌아오기 때문에, 여기서
 * 한 번 더 추가하면 본인 화면에서만 메시지가 두 번 보이는 버그가 생긴다. 목록은
 * 전적으로 GameScreen의 subscribeRankingChat 구독 하나로만 채운다.
 */
export function ChatSheet({
  team,
  clientId,
  myNickname,
  messages,
  bossTopRanks,
  onClose,
}: {
  team: TeamId;
  clientId: string;
  myNickname: string | null;
  messages: RankingChatMessage[];
  /** "닉네임(소문자) → 서휘령 랭킹모드 순위" — TOP10/TOP1 오오라·배지 표시용. */
  bossTopRanks: Record<string, number>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  /** 도배 방지 — 이 기기가 최근 보낸 시각들(서버 ranking_chat_send의 5초/3회 제한과 동일한 값). */
  const sendTimestamps = useRef<number[]>([]);

  // 새 메시지가 오면(또는 처음 열릴 때) 맨 아래로 — 일반 메신저와 같은 동작.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    if (sending || !myNickname) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed.length > CHAT_TEXT_MAX) {
      setError(`${CHAT_TEXT_MAX}자 이내로 입력해주세요.`);
      return;
    }
    if (containsBannedWord(trimmed)) {
      setError("비속어·성적인 표현은 쓸 수 없습니다.");
      return;
    }
    const now = Date.now();
    sendTimestamps.current = sendTimestamps.current.filter((t) => now - t < CHAT_RATE_LIMIT_WINDOW_MS);
    if (sendTimestamps.current.length >= CHAT_RATE_LIMIT_MAX) {
      setError("너무 빨리 보내고 있어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const result = await sendRankingChatMessage(clientId, team, trimmed);
      if (!result.ok || !result.message) {
        setError(
          result.reason === "not_registered"
            ? "강화에 닉네임을 등록해야 채팅을 보낼 수 있습니다."
            : result.reason === "rate_limited"
              ? "너무 빨리 보내고 있어요. 잠시 후 다시 시도해주세요."
              : "지금은 보낼 수 없습니다. 잠시 후 다시 시도해주세요."
        );
        return;
      }
      sendTimestamps.current.push(now);
      setDraft("");
    } catch {
      setError("지금은 보낼 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet chat-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="랭킹 채팅"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <header className="sheet-head">
          <div>
            <p className="sheet-energy-label">랭킹 채팅</p>
            <p className="chat-sheet-note">강화 닉네임 등록자 전용</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 && <p className="chat-empty">아직 메시지가 없습니다.</p>}
          {messages.map((m) => {
            // 강화 닉네임은 "같은 팀 안에서만" 유일해서, 노아·연 양쪽에 같은 닉네임이
            // 동시에 있을 수 있다 — 그래서 닉네임만이 아니라 보낸 팀까지 같이 비교한다.
            const mine = myNickname !== null && m.nickname === myNickname && m.enhanceTeam === team;
            const rank = bossTopRanks[m.nickname.toLowerCase()] ?? null;
            const aura = chatRankAuraClass(rank) ?? chatAuraClass(m.enhanceTeam, m.enhanceLevel);
            const rankBadge = chatRankBadge(rank);
            return (
              <div key={m.id} className={`chat-msg-row ${mine ? "chat-msg-row--mine" : "chat-msg-row--theirs"}`}>
                <div className={`chat-bubble ${mine ? "chat-bubble--mine" : "chat-bubble--theirs"} ${aura ?? ""}`}>
                  {!mine && (
                    <span className="chat-bubble-name">
                      {m.nickname}
                      {m.enhanceLevel > 0 && <span className="chat-bubble-level">{m.enhanceLevel}강</span>}
                      {rankBadge && (
                        <span className={`chat-bubble-rank ${rank === 1 ? "chat-bubble-rank--top1" : ""}`}>
                          {rankBadge}
                        </span>
                      )}
                      {rank === 1 && <span className="chat-bubble-rank-title">{CHAT_RANK_TOP1_TITLE}</span>}
                    </span>
                  )}
                  <span className="chat-bubble-text">{m.text}</span>
                </div>
              </div>
            );
          })}
        </div>

        {myNickname ? (
          <>
            <div className="chat-input-row">
              <input
                className="chat-input"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                maxLength={CHAT_TEXT_MAX}
                placeholder="메시지를 입력하세요"
                aria-label="랭킹 채팅 메시지 입력"
                autoFocus
              />
              <button className="chat-send" onClick={() => void send()} disabled={sending} aria-label="전송">
                전송
              </button>
            </div>
            {error && <p className="shout-error">{error}</p>}
          </>
        ) : (
          <p className="chat-locked-note">강화에 닉네임을 등록해야 채팅을 보낼 수 있습니다.</p>
        )}
      </section>
    </div>
  );
}
