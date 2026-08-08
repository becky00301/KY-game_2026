"use client";

import CardArt from "./CardArt";
import { CardInfo } from "@/lib/cards";
import { TeamTheme } from "@/lib/game";

/** 진화 순간 팀 전원에게 뜨는 카드 공개 연출. */
export default function CardReveal({
  card,
  theme,
  onClose,
}: {
  card: CardInfo;
  theme: TeamTheme;
  onClose: () => void;
}) {
  return (
    <div className="reveal-backdrop" onClick={onClose}>
      <div className="reveal-rays" aria-hidden="true" />
      <section className="reveal-card" onClick={(e) => e.stopPropagation()}>
        <p className="reveal-kicker">{theme.short}의 칼이 진화했다</p>

        <div className="reveal-frame">
          <CardArt card={card} theme={theme} />
        </div>

        <h2 className="reveal-title">{card.title}</h2>
        <p className="reveal-caption">{card.caption}</p>
        {card.artist && <p className="reveal-artist">그림 {card.artist}</p>}

        <p className="reveal-unlock">카드 {card.stage + 1}번 해금 · 생산량 ×{Math.pow(1.5, card.stage).toFixed(1)}</p>

        <button className="reveal-close" onClick={onClose}>
          계속 두드리기
        </button>
      </section>
    </div>
  );
}
