"use client";

import { useEffect, useRef, useState } from "react";
import { BOSS_CARDS, BOSS_INTRO } from "@/lib/boss";
import { playCardRevealSound } from "@/lib/sfx";
import VolumeButton from "./VolumeButton";

type IntroPhase = "dark" | "lines" | "flash" | "image";

export function BossIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<IntroPhase>("dark");
  const [line, setLine] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    doneRef.current();
  };
  useEffect(() => {
    if (phase === "lines") return;
    const timer = window.setTimeout(() => {
      if (phase === "dark") setPhase("lines");
      else if (phase === "flash") setPhase("image");
      else finish();
    }, phase === "image" ? 3500 : phase === "dark" ? 450 : 220);
    return () => window.clearTimeout(timer);
  }, [phase]);
  const advance = () => {
    if (phase !== "lines") return;
    if (line === BOSS_INTRO.lines.length - 1) setPhase("flash");
    else setLine((n) => n + 1);
  };
  const current = BOSS_INTRO.lines[line];
  return (
    <section className="boss-intro boss-theme" role="dialog" aria-modal="true" aria-label="서휘령 도입부">
      <button className="tutorial-skip boss-skip" onClick={finish} autoFocus>건너뛰기</button>
      {phase === "lines" && (
        <button className="boss-dialogue-advance" onClick={advance} aria-label="다음 대사">
          {current.portrait && <img className="boss-portrait" src={BOSS_INTRO.portraitSrc} alt="서휘령" />}
          <div className="tutorial-dialogue" aria-live="polite">
            <p className="tutorial-name">{current.name}</p>
            <p className="tutorial-line">{current.text}</p>
            <p className="tutorial-next-hint">탭하여 계속</p>
          </div>
        </button>
      )}
      {phase === "flash" && <div className="cutscene-flash" />}
      {phase === "image" && (
        <div className="boss-reveal-image-wrap">
          <img className="boss-reveal-image" src={BOSS_INTRO.revealBgSrc} alt="몰락한 검귀 서휘령" />
          <p className="boss-reveal-caption">{BOSS_INTRO.revealCaption}</p>
        </div>
      )}
    </section>
  );
}

export function BossMap({ onExit, onGallery, onSettings, soundOn, onToggleSound, onEnter }: {
  onExit: () => void;
  onGallery: () => void;
  onSettings: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  onEnter: () => void;
}) {
  return (
    <section className="boss-map-screen boss-theme" aria-label="서휘령 입장맵">
      <div className="boss-map-bg" />
      <header className="hud boss-map-hud">
        <div className="hud-row">
          <div className="team-badge">
            <img className="badge-emblem" src="/images/boss/boss-badge-emblem.webp" alt="" />
            <span className="badge-text">휘령의 검</span>
          </div>
          <div className="hud-right">
            <button className="icon-btn" onClick={onGallery} aria-label="서휘령 도감 열기">
              <img src="/images/boss/boss-gallery-icon.webp" width={24} height={24} alt="" />
            </button>
            <VolumeButton on={soundOn} onClick={onToggleSound} />
            <button className="icon-btn" onClick={onSettings} aria-label="환경설정 열기">
              <img src="/images/icons-misc/settings-icon-unified.webp" width={22} height={22} alt="" />
            </button>
          </div>
        </div>
      </header>
      <div className="boss-map-content">
        <h1 className="boss-map-heading"><img className="boss-map-title" src="/images/boss/boss-map-title.webp" alt="타도 : 검귀 서휘령" /></h1>
        <p className="boss-map-subtitle">몰락한 검귀, 서휘령의 검이 요동치고 있다.<br />그를 제압할 방법이 있을 것 같은데..</p>
        <div className="boss-map-sword-wrap"><img className="boss-map-sword" src="/images/boss/boss-map-sword.webp" alt="서휘령의 검" /></div>
      </div>
      <div className="boss-map-actions">
        <button className="boss-map-exit-btn-bottom" onClick={onExit}>나가기</button>
        <button className="boss-map-enter-btn" onClick={onEnter}>입장하기</button>
      </div>
    </section>
  );
}

function BossCardPlaceholder({ locked = false }: { locked?: boolean }) {
  return (
    <div className={`card-art ${locked ? "locked" : "fallback"}`}>
      <span className="card-lock">?</span>
      {!locked && <><span className="card-fallback-title">???</span><span className="card-fallback-note">일러스트 준비 중</span></>}
    </div>
  );
}

export function BossCardUnlock({ onClose }: { onClose: () => void }) {
  useEffect(() => { playCardRevealSound(); }, []);
  return (
    <div className="reveal-backdrop boss-theme" onClick={onClose}>
      <section className="reveal-card reveal-card--boss" role="dialog" aria-modal="true" aria-label="서휘령 이야기 해금" onClick={(e) => e.stopPropagation()}>
        <p className="reveal-kicker">서휘령의 이야기를 알게 되었다</p>
        <div className="reveal-frame"><BossCardPlaceholder locked /></div>
        <h2 className="reveal-title">???</h2>
        <p className="reveal-caption">일러스트와 이야기는 아직 준비 중입니다.</p>
        <button className="reveal-close" onClick={onClose} autoFocus>계속하기</button>
      </section>
    </div>
  );
}

export function BossGallery({ unlocked, onClose }: { unlocked: boolean; onClose: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = BOSS_CARDS.find((card) => card.id === openId);
  return (
    <div className="sheet-backdrop boss-theme" onClick={onClose}>
      <section className="sheet gallery sheet--boss" role="dialog" aria-modal="true" aria-label="몰락한 검귀의 이야기" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <header className="sheet-head">
          <div><p className="sheet-energy">{unlocked ? 1 : 0} / {BOSS_CARDS.length}</p><p className="sheet-energy-label">몰락한 검귀의 이야기</p></div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기" autoFocus>✕</button>
        </header>
        <p className="sheet-note">서휘령을 격파하세요. 그에게 숨겨진 이야기가 공개됩니다.</p>
        <ul className="gallery-grid">
          {BOSS_CARDS.map((card) => {
            const locked = card.id !== "intro" || !unlocked;
            return <li key={card.id}><button className={`gallery-item ${locked ? "locked" : ""}`} disabled={locked} onClick={() => setOpenId(card.id)} aria-label={locked ? "아직 열리지 않은 카드" : "서휘령 첫 번째 이야기 확대"}>
              <BossCardPlaceholder locked={locked} /><span className="gallery-name">{card.title}</span>
            </button></li>;
          })}
        </ul>
        {open && <div className="gallery-zoom" onClick={() => setOpenId(null)}>
          <section className="reveal-card reveal-card--boss" onClick={(e) => e.stopPropagation()}>
            <div className="reveal-frame"><BossCardPlaceholder /></div>
            <h2 className="reveal-title">{open.title}</h2><p className="reveal-caption">{open.caption}</p>
            <button className="reveal-close" onClick={() => setOpenId(null)} autoFocus>닫기</button>
          </section>
        </div>}
      </section>
    </div>
  );
}
