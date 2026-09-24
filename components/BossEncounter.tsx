"use client";

import { useEffect, useRef, useState } from "react";
import { BOSS_CARDS, BOSS_INTRO } from "@/lib/boss";
import {
  RankingEntry,
  checkNicknameAvailable,
  fetchRankings,
  isNicknameFormatValid,
  loadSavedNickname,
  saveNickname,
} from "@/lib/bossRanking";
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

export function BossMap({
  onExit,
  onGallery,
  onSettings,
  soundOn,
  onToggleSound,
  onEnter,
  onEnterRanking,
  onOpenRanking,
}: {
  onExit: () => void;
  onGallery: () => void;
  onSettings: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  onEnter: () => void;
  /** 랭킹모드로 입장(닉네임 입력부터) — 일반 입장(onEnter)과 완전히 같은 전투로 이어진다. */
  onEnterRanking: () => void;
  /** 순위표(1~10등 + 내 순위) 열기. */
  onOpenRanking: () => void;
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
      <div className="boss-map-actions boss-map-actions--grid">
        <div className="boss-map-actions-row boss-map-actions-row--small">
          <button className="boss-map-ranking-btn" onClick={onOpenRanking}>랭킹</button>
          <button className="boss-map-ranking-enter-btn" onClick={onEnterRanking}>랭킹모드 도전</button>
        </div>
        <div className="boss-map-actions-row">
          <button className="boss-map-exit-btn-bottom" onClick={onExit}>나가기</button>
          <button className="boss-map-enter-btn" onClick={onEnter}>입장하기</button>
        </div>
      </div>
    </section>
  );
}

/** 랭킹모드 입장 — 닉네임을 입력받는다(전역에서 대소문자 구분 없이 유일해야 함).
 *  성공하면 onSubmit(nickname)이 곧바로 일반 모드와 완전히 같은 전투로 이어진다. */
export function BossRankingEntry({
  onSubmit,
  onClose,
}: {
  onSubmit: (nickname: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(() => loadSavedNickname());
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (checking) return;
    const trimmed = value.trim();
    if (!isNicknameFormatValid(trimmed)) {
      setError("닉네임을 1~14자로 입력해주세요.");
      return;
    }
    setChecking(true);
    setError("");
    try {
      const available = await checkNicknameAvailable(trimmed);
      if (!available) {
        setError("이미 사용 중인 닉네임이에요.");
        return;
      }
      saveNickname(trimmed);
      onSubmit(trimmed);
    } catch {
      setError("확인 중 문제가 발생했어요. 다시 시도해주세요.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="sheet-backdrop boss-theme" onClick={onClose}>
      <section
        className="sheet boss-ranking-entry"
        role="dialog"
        aria-modal="true"
        aria-label="랭킹모드 닉네임 입력"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <header className="sheet-head">
          <p className="sheet-energy-label">랭킹모드 입장</p>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
        </header>
        <p className="sheet-note">
          닉네임은 다른 사람과 겹칠 수 없어요. 서휘령을 완전히 격파하면 클리어한 순서 그대로 랭킹에 기록됩니다.
        </p>
        <input
          className="boss-ranking-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          maxLength={14}
          placeholder="닉네임을 입력하세요"
          aria-label="닉네임"
          autoFocus
        />
        {error && <p className="boss-ranking-error">{error}</p>}
        <button className="boss-map-enter-btn boss-ranking-submit" onClick={submit} disabled={checking}>
          {checking ? "확인 중.." : "입장하기"}
        </button>
      </section>
    </div>
  );
}

/** 순위표 — 1~10등, 그리고 맨 아래 "내 순위"(이 기기가 마지막으로 쓴 닉네임 기준). */
export function BossRankingBoard({ onClose }: { onClose: () => void }) {
  const [top, setTop] = useState<RankingEntry[] | null>(null);
  const [mine, setMine] = useState<RankingEntry | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchRankings(loadSavedNickname() || undefined)
      .then((result) => {
        if (!alive) return;
        setTop(result.top);
        setMine(result.mine);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="sheet-backdrop boss-theme" onClick={onClose}>
      <section
        className="sheet boss-ranking-board"
        role="dialog"
        aria-modal="true"
        aria-label="서휘령 격파 랭킹"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <header className="sheet-head">
          <p className="sheet-energy-label">서휘령 격파 랭킹</p>
          <button className="icon-btn" onClick={onClose} aria-label="닫기" autoFocus>✕</button>
        </header>
        <p className="sheet-note">서휘령을 클리어한 순서 그대로 기록됩니다.</p>

        {loadFailed && <p className="boss-ranking-error">순위를 불러오지 못했어요.</p>}
        {!loadFailed && !top && <p className="boss-ranking-loading">불러오는 중..</p>}
        {top && (
          <ol className="boss-ranking-list">
            {top.length === 0 && <li className="boss-ranking-empty">아직 아무도 클리어하지 못했어요.</li>}
            {top.map((entry) => (
              <li key={entry.rank} className="boss-ranking-row">
                <span className="boss-ranking-rank">{entry.rank}</span>
                <span className="boss-ranking-name">{entry.nickname}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="boss-ranking-mine">
          <p className="boss-ranking-mine-label">내 순위</p>
          {mine ? (
            <div className="boss-ranking-row boss-ranking-row--mine">
              <span className="boss-ranking-rank">{mine.rank}</span>
              <span className="boss-ranking-name">{mine.nickname}</span>
            </div>
          ) : (
            <p className="boss-ranking-mine-empty">아직 랭킹에 등록되지 않았어요.</p>
          )}
        </div>
      </section>
    </div>
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

export function BossGallery({ unlocked, victoryUnlocked = false, onClose }: { unlocked: boolean; victoryUnlocked?: boolean; onClose: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = BOSS_CARDS.find((card) => card.id === openId);
  const unlockedCount = (unlocked ? 1 : 0) + (victoryUnlocked ? 1 : 0);
  return (
    <div className="sheet-backdrop boss-theme" onClick={onClose}>
      <section className="sheet gallery sheet--boss" role="dialog" aria-modal="true" aria-label="몰락한 검귀의 이야기" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <header className="sheet-head">
          <div><p className="sheet-energy">{unlockedCount} / {BOSS_CARDS.length}</p><p className="sheet-energy-label">몰락한 검귀의 이야기</p></div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기" autoFocus>✕</button>
        </header>
        <p className="sheet-note">서휘령을 격파하세요. 그에게 숨겨진 이야기가 공개됩니다.</p>
        <ul className="gallery-grid">
          {BOSS_CARDS.map((card) => {
            const locked = card.id === "intro" ? !unlocked : card.id === "victory" ? !victoryUnlocked : true;
            const openLabel = card.id === "victory" ? "서휘령 격파 이야기 확대" : "서휘령 첫 번째 이야기 확대";
            return <li key={card.id}><button className={`gallery-item ${locked ? "locked" : ""}`} disabled={locked} onClick={() => setOpenId(card.id)} aria-label={locked ? "아직 열리지 않은 카드" : openLabel}>
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
