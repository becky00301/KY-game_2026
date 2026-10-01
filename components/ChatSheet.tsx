"use client";

import { useEffect, useRef, useState } from "react";
import { RankingChatMessage, sendRankingChatMessage } from "@/lib/backend";
import { CHAT_TEXT_MAX, chatAuraClass } from "@/lib/chat";
import { TeamId } from "@/lib/game";
import { containsBannedWord } from "@/lib/profanity";

/**
 * 전체 화면으로 펼쳐지는 랭킹 채팅 — 보스 랭킹(서휘령 랭킹모드)에 닉네임을 등록한
 * 사람들끼리만 보낼 수 있다. 내가 보낸 메시지는 오른쪽, 남이 보낸 메시지는 왼쪽에
 * 뜨는 일반적인 메신저 말풍선 형태다. 22단계 이상 강화한 사람의 말풍선에는 단계별
 * 오오라 연출이 붙는다(lib/chat.ts의 chatAuraClass).
 */
export function ChatSheet({
  team,
  clientId,
  myNickname,
  myEnhanceLevel,
  messages,
  onSent,
  onClose,
}: {
  team: TeamId;
  clientId: string;
  myNickname: string | null;
  myEnhanceLevel: number;
  messages: RankingChatMessage[];
  onSent: (msg: RankingChatMessage) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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
    setSending(true);
    setError("");
    try {
      const result = await sendRankingChatMessage(clientId, trimmed, team, myEnhanceLevel);
      if (!result.ok || !result.message) {
        setError("지금은 보낼 수 없습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      onSent(result.message);
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
            <p className="chat-sheet-note">보스 랭킹 등록자 전용</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 && <p className="chat-empty">아직 메시지가 없습니다.</p>}
          {messages.map((m) => {
            const mine = myNickname !== null && m.nickname === myNickname;
            const aura = chatAuraClass(m.enhanceTeam, m.enhanceLevel);
            return (
              <div key={m.id} className={`chat-msg-row ${mine ? "chat-msg-row--mine" : "chat-msg-row--theirs"}`}>
                <div className={`chat-bubble ${mine ? "chat-bubble--mine" : "chat-bubble--theirs"} ${aura ?? ""}`}>
                  {!mine && <span className="chat-bubble-name">{m.nickname}</span>}
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
          <p className="chat-locked-note">보스 랭킹(서휘령 랭킹모드)에 닉네임을 등록해야 채팅을 보낼 수 있습니다.</p>
        )}
      </section>
    </div>
  );
}
