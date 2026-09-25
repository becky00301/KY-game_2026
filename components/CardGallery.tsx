"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  const [open, setOpenCard] = useState<CardInfo | null>(null);
  /** 확대한 카드가 뒤집혀 이야기 면이 보이는 중인지 */
  const [flipped, setFlipped] = useState(false);
  const setOpen = (card: CardInfo | null) => {
    setOpenCard(card);
    setFlipped(false);
  };
  const maxStage = theme.stages.length - 1;
  const allCards = useMemo(() => [...cards, bonusCard], [cards, bonusCard]);
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
          {theme.copy.gallerySheetNote ?? "검술이 성장할 때마다 새로운 이야기가 공개된다."}
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
                  <CardArt card={card} theme={theme} locked={locked} />
                  <span className="gallery-name">{locked ? "???" : card.title}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/*
          확대 보기는 body로 빼서 띄운다. 도감 시트 안에 두면 시트의 transform 때문에
          position: fixed가 화면이 아니라 시트 기준이 되어, 시트 높이만큼만 보이고 잘렸다.
        */}
        {open && createPortal(
          <div className="gallery-zoom" onClick={() => setOpen(null)}>
            {/* 앞면은 일러스트만, 누르면 뒤집혀서 이야기가 보인다. 바깥을 누르면 닫힌다. */}
            <div
              className={`flip-card ${openGrand ? "flip-card--grand" : ""} ${flipped ? "flipped" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={flipped ? "그림 다시 보기" : "카드 뒤집어 이야기 보기"}
              onClick={(e) => {
                e.stopPropagation();
                setFlipped((f) => !f);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFlipped((f) => !f);
                }
              }}
            >
              <div className="flip-inner">
                <div className="flip-face flip-front reveal-frame" aria-hidden={flipped}>
                  <CardArt card={open} theme={theme} grand={openGrand} />
                </div>
                <div className="flip-face flip-back" aria-hidden={!flipped}>
                  <h3 className="reveal-title">{open.title}</h3>
                  {open.caption && <p className="reveal-caption">{open.caption}</p>}
                  {open.lore && <p className="reveal-lore">{open.lore}</p>}
                  {open.artist && <p className="reveal-artist">그림 {open.artist}</p>}
                </div>
              </div>
            </div>
            <p className="flip-hint">
              {flipped ? "카드를 누르면 그림으로 · 바깥을 누르면 닫기" : "숨겨진 이야기가 드러난다."}
            </p>
          </div>,
          document.body
        )}
      </section>
    </div>
  );
}
