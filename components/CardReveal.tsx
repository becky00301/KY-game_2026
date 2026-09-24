"use client";

import { useEffect, useState } from "react";
import CardArt from "./CardArt";
import { CardInfo } from "@/lib/cards";
import { TeamTheme } from "@/lib/game";
import { stageMultiplier } from "@/lib/engine";
import { playCardRevealSound } from "@/lib/sfx";

/** 전체 화면 일러스트를 보여준 뒤 자동으로 카드 화면으로 넘어가기까지의 시간 */
const SPLASH_AUTO_MS = 4000;

/** 진화 순간(또는 후일담 카드 해금 순간) 팀 전원에게 뜨는 카드 공개 연출. */
export default function CardReveal({
  card,
  theme,
  onClose,
}: {
  card: CardInfo;
  theme: TeamTheme;
  onClose: () => void;
}) {
  // 먼저 테두리 없이 일러스트만 화면 가득 보여주고, 누르면(또는 잠시 뒤) 카드 화면으로 넘어간다.
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    playCardRevealSound();
  }, []);

  useEffect(() => {
    if (!splash) return;
    const timer = window.setTimeout(() => setSplash(false), SPLASH_AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [splash]);

  if (splash) {
    return (
      <div
        className="reveal-splash"
        role="button"
        tabIndex={0}
        autoFocus
        aria-label={`${card.title} 일러스트 — 눌러서 계속`}
        onClick={() => setSplash(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "Escape") setSplash(false);
        }}
      >
        <img className="reveal-splash-bg" src={card.image} alt="" aria-hidden="true" />
        {/* 그림 파일이 없으면 이 단계를 건너뛰고 바로 카드 화면(대체 그림)으로 간다 */}
        <img className="reveal-splash-img" src={card.image} alt={card.title} onError={() => setSplash(false)} />
        <p className="reveal-splash-hint">터치하여 계속</p>
      </div>
    );
  }

  // 5단계(이후) 카드는 단일 포커스 뷰에서 훨씬 큰 정사각형 틀로 보여준다.
  const grand = card.stage >= 4;
  const kicker = card.bonus
    ? "새로운 이야기가 도착했다"
    : theme.copy.revealKicker?.(theme.short) ?? `${theme.short}의 칼이 진화했다`;
  const continueLabel = theme.copy.continueLabel ?? "계속 두드리기";

  return (
    <div className="reveal-backdrop" onClick={onClose}>
      <div className="reveal-rays" aria-hidden="true" />
      <section
        className={`reveal-card ${grand ? "reveal-card--grand" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="reveal-kicker">{kicker}</p>

        <div className="reveal-frame">
          <CardArt
            card={card}
            theme={theme}
            grand={grand}
          />
        </div>

        <h2 className="reveal-title">{card.title}</h2>
        {card.caption && <p className="reveal-caption">{card.caption}</p>}
        {card.lore && <p className="reveal-lore">{card.lore}</p>}
        {card.artist && <p className="reveal-artist">그림 {card.artist}</p>}

        {/* 후일담 카드는 검 강화 수치와 무관해서 이 줄은 의미가 없다 */}
        {!card.bonus && (
          <p className="reveal-unlock">
            {theme.copy.unlockLabel?.(card.stage + 1) ?? `카드 ${card.stage + 1}번 해금`} · 생산량 ×
            {stageMultiplier(card.stage).toFixed(1)}
          </p>
        )}

        <button className="reveal-close" onClick={onClose}>
          {continueLabel}
        </button>
      </section>
    </div>
  );
}
