"use client";

import { useMemo, useState } from "react";
import CardArt from "./CardArt";
import { CardInfo, isCardLocked } from "@/lib/cards";
import { TeamTheme } from "@/lib/game";

/** 지금까지 팀이 열어낸 카드를 모아 보는 도감. 6번째 칸은 별 5개를 채워야 열리는 후일담 카드. */
export default function CardGallery({
  cards,
  bonusCard,
  stage,
  stars,
  theme,
  onClose,
}: {
  cards: CardInfo[];
  bonusCard: CardInfo;
  stage: number;
  stars: number;
  theme: TeamTheme;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<CardInfo | null>(null);
  const maxStage = theme.stages.length - 1;
  const allCards = useMemo(() => [...cards, bonusCard], [cards, bonusCard]);
  const emblemEvolved = stage >= maxStage;
  const unlocked = allCards.filter((c) => !isCardLocked(c, stage, stars, maxStage)).length;

  const openGrand = open ? open.stage >= 4 : false;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet gallery" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />

        <header className="sheet-head">
          <div>
            <p className="sheet-energy">
              {unlocked} / {allCards.length}
            </p>
            <p className="sheet-energy-label">{theme.copy.galleryTitle ?? `${theme.short} 칼 도감`}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <p className="sheet-note">
          {theme.copy.gallerySheetNote ?? "칼이 진화할 때마다 카드가 열립니다. 함께 두드려 남은 카드를 찾아보세요."}
        </p>

        <ul className="gallery-grid">
          {allCards.map((card) => {
            const locked = isCardLocked(card, stage, stars, maxStage);
            return (
              <li key={card.bonus ? "bonus" : card.stage}>
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
            <div
              className={`reveal-frame ${openGrand ? "reveal-frame--grand" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <CardArt card={open} theme={theme} emblemEvolved={emblemEvolved} grand={openGrand} />
              <h3 className="reveal-title">{open.title}</h3>
              {open.caption && <p className="reveal-caption">{open.caption}</p>}
              {open.lore && <p className="reveal-lore">{open.lore}</p>}
              {open.artist && <p className="reveal-artist">그림 {open.artist}</p>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
