"use client";

import { useState } from "react";
import CardArt from "./CardArt";
import { CardInfo } from "@/lib/cards";
import { TeamTheme } from "@/lib/game";

/** 지금까지 팀이 열어낸 카드를 모아 보는 도감. */
export default function CardGallery({
  cards,
  stage,
  theme,
  onClose,
}: {
  cards: CardInfo[];
  stage: number;
  theme: TeamTheme;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<CardInfo | null>(null);
  const unlocked = cards.filter((c) => c.stage <= stage).length;
  const emblemEvolved = stage >= cards.length - 1;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet gallery" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />

        <header className="sheet-head">
          <div>
            <p className="sheet-energy">
              {unlocked} / {cards.length}
            </p>
            <p className="sheet-energy-label">{theme.short} 칼 도감</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <p className="sheet-note">
          칼이 진화할 때마다 카드가 열립니다. 함께 두드려 남은 카드를 찾아보세요.
        </p>

        <ul className="gallery-grid">
          {cards.map((card) => {
            const locked = card.stage > stage;
            return (
              <li key={card.stage}>
                <button
                  className={`gallery-item ${locked ? "locked" : ""}`}
                  onClick={() => !locked && setOpen(card)}
                  disabled={locked}
                  aria-label={locked ? "아직 열리지 않은 카드" : card.title}
                >
                  <CardArt card={card} theme={theme} locked={locked} emblemEvolved={emblemEvolved} />
                  <span className="gallery-name">{locked ? "???" : card.title}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {open && (
          <div className="gallery-zoom" onClick={() => setOpen(null)}>
            <div className="reveal-frame" onClick={(e) => e.stopPropagation()}>
              <CardArt card={open} theme={theme} emblemEvolved={emblemEvolved} />
              <h3 className="reveal-title">{open.title}</h3>
              <p className="reveal-caption">{open.caption}</p>
              {open.artist && <p className="reveal-artist">그림 {open.artist}</p>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
