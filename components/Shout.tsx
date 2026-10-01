"use client";

import { useState } from "react";
import { postShout } from "@/lib/backend";
import { SHOUT_COST, SHOUT_GLOBAL_COOLDOWN_SEC } from "@/lib/engine";
import { TEAMS, TeamId, formatNumber } from "@/lib/game";
import { containsBannedWord } from "@/lib/profanity";

const NICKNAME_MAX = 14;
const TEXT_MAX = 30;

type Step = "confirm" | "nickname" | "text";

/** "함성" — 재화를 써서 화면 전체에 문구를 띄우는 기능의 입력 흐름(확인 → 닉네임 → 문구). */
export function ShoutSheet({
  team,
  spirit,
  clientId,
  onClose,
}: {
  team: TeamId;
  spirit: string;
  clientId: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("confirm");
  const [nickname, setNickname] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submitNickname = () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 1 || trimmed.length > NICKNAME_MAX) {
      setError(`닉네임은 1~${NICKNAME_MAX}자까지 입력 가능합니다.`);
      return;
    }
    if (containsBannedWord(trimmed)) {
      setError("닉네임에 비속어·성적인 표현은 쓸 수 없습니다.");
      return;
    }
    setNickname(trimmed);
    setError("");
    setStep("text");
  };

  const submitText = async () => {
    if (sending) return;
    const trimmed = text.trim();
    if (trimmed.length < 1 || trimmed.length > TEXT_MAX) {
      setError(`${TEXT_MAX}자 이내로 입력해주세요.`);
      return;
    }
    if (containsBannedWord(trimmed)) {
      setError("비속어·성적인 표현은 쓸 수 없습니다.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const result = await postShout(team, clientId, nickname, trimmed);
      if (!result.ok) {
        setError(
          result.reason === "insufficient"
            ? `${spirit}이(가) 부족합니다.`
            : result.reason === "global-cooldown"
              ? `다른 사람이 방금 사용했습니다. ${SHOUT_GLOBAL_COOLDOWN_SEC}초 뒤 다시 시도해주세요.`
              : "지금은 사용할 수 없습니다. 잠시 후 다시 시도해주세요."
        );
        return;
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet shout-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="함성"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <header className="sheet-head">
          <p className="sheet-energy-label">함성</p>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        {step === "confirm" && (
          <>
            <p className="sheet-note">
              {spirit} {formatNumber(SHOUT_COST)}을 사용해서 게임에 전체 텍스트를 띄울 수 있습니다.
            </p>
            <button className="reveal-close" onClick={() => setStep("nickname")}>
              확인
            </button>
          </>
        )}

        {step === "nickname" && (
          <>
            <p className="sheet-note">함성에 표시할 닉네임을 입력하세요.</p>
            <input
              className="shout-input"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNickname();
              }}
              maxLength={NICKNAME_MAX}
              placeholder="닉네임"
              aria-label="닉네임"
              autoFocus
            />
            {error && <p className="shout-error">{error}</p>}
            <button className="reveal-close" onClick={submitNickname}>
              확인
            </button>
          </>
        )}

        {step === "text" && (
          <>
            <p className="sheet-note">모두에게 보여질 문구를 입력하세요 ({TEXT_MAX}자 이내).</p>
            <input
              className="shout-input"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitText();
              }}
              maxLength={TEXT_MAX}
              placeholder="외치고 싶은 말"
              aria-label="함성 문구"
              autoFocus
            />
            {error && <p className="shout-error">{error}</p>}
            <button className="reveal-close" onClick={() => void submitText()} disabled={sending}>
              {sending ? "보내는 중…" : "보내기"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * 화면 상단에 크게 번쩍이며 뜨는 함성 배너 — 부모가 5초 뒤 unmount한다. 색은 보는 사람의
 * 팀이 아니라 "보낸" 팀 색으로 고정한다 — 연이 보내면 노아 화면에서도 파란색으로 보인다.
 */
export function ShoutBanner({ team, nickname, text }: { team: TeamId; nickname: string; text: string }) {
  const colors = TEAMS[team].colors;
  return (
    <div
      className="shout-banner"
      role="status"
      style={
        {
          "--shout-color": colors.primary,
          "--shout-color-deep": colors.primaryDeep,
          "--shout-glow": colors.glow,
          "--shout-accent": colors.accent,
        } as React.CSSProperties
      }
    >
      <span className="shout-banner-name">{nickname}</span>
      <span className="shout-banner-text">{text}</span>
    </div>
  );
}
