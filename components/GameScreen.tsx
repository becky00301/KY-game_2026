"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sword from "./Sword";
import UpgradeSheet from "./UpgradeSheet";
import CardReveal from "./CardReveal";
import CardGallery from "./CardGallery";
import SettingsSheet from "./SettingsSheet";
import FeverPop from "./FeverPop";
import EvolveCutscene, { EVOLVE_CUTSCENES } from "./EvolveCutscene";
import { CardInfo, bonusCardFor, cardsFor } from "@/lib/cards";
import {
  AURA_PEAK,
  AURA_SIZE,
  FEVER_DURATION_MS,
  FEVER_MAX,
  FEVER_MULTIPLIER,
  MAX_TAPS_PER_SECOND,
  SWORD_STAGE_SCALE,
  SwordState,
  accrue,
  autoPerSecond,
  createSword,
  isFeverActive,
  rateBonus,
  stageOf,
  stageProgress,
  starRank,
  tapPower,
} from "@/lib/engine";
import { TEAMS, emblemSrc, formatNumber, formatRate, hasSeenEvolveCutscene, hexToRgbString, markEvolveCutsceneSeen } from "@/lib/game";
import {
  backendMode,
  buyUpgrade,
  clientId,
  fetchSword,
  sendTaps,
  subscribePresence,
  subscribeSword,
} from "@/lib/backend";
import { isSfxEnabled, playFeverStartSound, playHit, setSfxEnabled, unlockAudio } from "@/lib/sfx";
import {
  bgmGroupSuffix,
  gameplayGroupOf,
  playGameplayBgm,
  setGameplayBgmMuted,
  stopGameplayBgm,
} from "@/lib/bgm";
import { TeamId } from "@/lib/game";

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  fever: boolean;
}

interface TapEffect {
  id: number;
  x: number;
  y: number;
  src: string;
}

/** 터치할 때마다 터진 자리에 잠깐 뜨는 파티클 애니메이션(WebP) */
const TAP_EFFECT_SRC: Record<TeamId, string> = {
  ku: "/images/tap-effect/ku-tap-effect.webp",
  yu: "/images/tap-effect/yu-tap-effect.webp",
};

/** 상단 도감 버튼 아이콘 — 팀 전용 이미지 (음소거 버튼은 가시성 이슈로 이모지 유지) */
const GALLERY_ICON_SRC: Record<TeamId, string> = {
  ku: "/images/icons-gallery/gallery-icon-ku.webp",
  yu: "/images/icons-gallery/gallery-icon-yu.webp",
};
/** 애니메이션 webp 총 재생시간과 맞춘 제거 시점 */
const TAP_EFFECT_DURATION_MS = 950;

const COMBO_WINDOW_MS = 1_200;
const COMBO_MAX = 100;
const FLUSH_INTERVAL_MS = 1_000;
/** 내가 이 칼에 보탠 터치 수 (자랑용, 이 기기에만 저장) */
const CONTRIB_KEY = "kyg.contrib";

export default function GameScreen({
  team,
  onChangeTeam,
  justFinishedTutorial = false,
}: {
  team: TeamId;
  onChangeTeam: () => void;
  /** 튜토리얼을 막 마치고 들어온 경우 — 1단계 도감 카드 팝업을 자동으로 띄운다 */
  justFinishedTutorial?: boolean;
}) {
  const [sword, setSword] = useState<SwordState>(() => createSword(team));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [tapEffects, setTapEffects] = useState<TapEffect[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revealCard, setRevealCard] = useState<CardInfo | null>(null);
  const [cutsceneOpen, setCutsceneOpen] = useState(false);
  const [feverPopKey, setFeverPopKey] = useState(0);
  const [sfxOn, setSfxOn] = useState(true);
  const [hitting, setHitting] = useState(false);
  const [contrib, setContrib] = useState(0);
  const [online, setOnline] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const lastTapAt = useRef(0);
  const tapWindow = useRef<number[]>([]);
  const pendingTaps = useRef(0);
  const pendingSince = useRef(Date.now());
  const floaterId = useRef(0);
  const tapEffectId = useRef(0);
  const swordRef = useRef<HTMLDivElement>(null);
  const prevStage = useRef(0);
  const prevStars = useRef(0);
  const prevFeverUntil = useRef(0);
  const swordStateRef = useRef(sword);
  swordStateRef.current = sword;

  const theme = TEAMS[team];
  const stage = stageOf(sword.lifetime);
  const bgmGroup = gameplayGroupOf(stage);
  const progress = stageProgress(sword.lifetime);
  const stars = starRank(sword.lifetime);
  const perTap = tapPower(sword);
  const perSec = autoPerSecond(sword);
  const feverActive = isFeverActive(sword);
  const maxStage = theme.stages.length - 1;
  const isMaxStage = stage >= maxStage;

  // 테마 색상 주입
  useEffect(() => {
    const root = document.documentElement;
    const c = theme.colors;
    root.style.setProperty("--primary", c.primary);
    root.style.setProperty("--primary-deep", c.primaryDeep);
    root.style.setProperty("--accent", c.accent);
    root.style.setProperty("--glow", c.glow);
    root.style.setProperty("--glow-rgb", hexToRgbString(c.glow));
    root.style.setProperty("--bg-from", c.bgFrom);
    root.style.setProperty("--bg-to", c.bgTo);
  }, [theme]);

  // 게임 화면을 나가면(팀 선택으로 돌아가면) 브금을 완전히 정지한다.
  useEffect(() => stopGameplayBgm, []);

  // 진화 단계 그룹이 바뀔 때만 트랙을 교체한다.
  useEffect(() => {
    playGameplayBgm(team, bgmGroup);
  }, [team, bgmGroup]);

  // 기존 🔊/🔇 버튼과 연동 — 타격 효과음뿐 아니라 이 브금도 같이 음소거한다.
  useEffect(() => {
    setGameplayBgmMuted(!sfxOn);
  }, [sfxOn]);

  // 첫 로딩 + 다른 사람의 터치 구독
  useEffect(() => {
    let alive = true;
    setReady(false);
    setContrib(Number(window.localStorage.getItem(`${CONTRIB_KEY}.${team}`) ?? 0));

    fetchSword(team)
      .then((state) => {
        if (!alive) return;
        prevStage.current = stageOf(state.lifetime);
        prevStars.current = starRank(state.lifetime);
        prevFeverUntil.current = state.feverUntil;
        setSword(state);
        setReady(true);
        setError(null);

        // 이미 5단계인 상태로 재접속했는데 아직 컷씬을 못 봤다면 진입 시 1회 자동 재생.
        const reachedMax = stageOf(state.lifetime) >= theme.stages.length - 1;
        if (reachedMax && EVOLVE_CUTSCENES[team] && !hasSeenEvolveCutscene(team)) {
          markEvolveCutsceneSeen(team);
          setCutsceneOpen(true);
        } else if (justFinishedTutorial) {
          // 튜토리얼을 막 마쳤으면 1단계 도감 카드 팝업을 자동으로 띄운다.
          setRevealCard(cardsFor(team, theme.stages)[0]);
        }
      })
      .catch((e: Error) => alive && setError(e.message));

    const unsubscribe = subscribeSword(team, (state) => {
      if (!alive) return;
      // 내 낙관적 예측이 서버보다 앞서 있을 수 있으니 누적치가 큰 쪽을 남긴다.
      setSword((prev) => (state.lifetime >= prev.lifetime ? state : prev));
      setError(null);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team]);

  // 지금 같은 칼을 보고 있는 사람 수
  useEffect(() => {
    setOnline(0);
    const unsubscribe = subscribePresence(team, setOnline);
    return unsubscribe;
  }, [team]);

  // 밀린 터치를 서버로 보낸다
  useEffect(() => {
    const timer = window.setInterval(async () => {
      const taps = pendingTaps.current;
      if (taps <= 0) return;
      const elapsed = (Date.now() - pendingSince.current) / 1000;
      pendingTaps.current = 0;
      pendingSince.current = Date.now();
      try {
        const state = await sendTaps(team, taps, elapsed, clientId());
        setSword((prev) => (state.lifetime >= prev.lifetime ? state : prev));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }, FLUSH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [team]);

  // 자동 응원을 화면에서도 흐르게 보여준다 (서버 값과는 다음 동기화에서 맞춰진다)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSword((prev) => accrue(prev));
      if (Date.now() - lastTapAt.current > COMBO_WINDOW_MS) {
        setCombo((c) => (c > 0 ? 0 : c));
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, []);

  // 진화하면 카드를 공개한다 — 단, 5단계에 처음 도달하는 순간엔 카드 대신 전용 컷씬이 뜬다.
  useEffect(() => {
    if (!ready) return;
    if (stage > prevStage.current) {
      prevStage.current = stage;
      const reachedMax = stage >= maxStage;
      if (reachedMax && EVOLVE_CUTSCENES[team] && !hasSeenEvolveCutscene(team)) {
        markEvolveCutsceneSeen(team);
        setCutsceneOpen(true);
      } else {
        const cards = cardsFor(team, theme.stages);
        setRevealCard(cards[Math.min(stage, cards.length - 1)]);
      }
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    }
    prevStage.current = stage;
  }, [stage, ready, team, theme.stages, maxStage]);

  // 최종 단계 도달 후에도 별이 계속 붙는다 — 별 5개(후일담 해금)가 되는 순간 카드 팝업.
  useEffect(() => {
    if (!ready) return;
    if (stars > prevStars.current) {
      prevStars.current = stars;
      if (isMaxStage && stars >= 5) {
        setRevealCard(bonusCardFor(team, theme.stages));
      }
    } else {
      prevStars.current = stars;
    }
  }, [stars, ready, isMaxStage, team, theme.stages]);

  // 팀 전체 응원 열기 발동 — 사운드/진동 피드백 + 캐릭터 팝업 (전체화면 모달은 없앴다)
  useEffect(() => {
    if (!ready) return;
    if (sword.feverUntil > prevFeverUntil.current && sword.feverUntil > Date.now()) {
      prevFeverUntil.current = sword.feverUntil;
      playFeverStartSound();
      if (navigator.vibrate) navigator.vibrate([20, 30, 20, 30, 60]);
      setFeverPopKey((k) => k + 1);
      return;
    }
    prevFeverUntil.current = Math.max(prevFeverUntil.current, sword.feverUntil);
  }, [sword.feverUntil, ready]);

  const pushFloater = useCallback((x: number, y: number, text: string, fever: boolean) => {
    const id = floaterId.current++;
    setFloaters((f) => [...f.slice(-14), { id, x, y, text, fever }]);
    window.setTimeout(() => setFloaters((f) => f.filter((n) => n.id !== id)), 900);
  }, []);

  // 터칠 때마다(콤보·피버와 무관하게 매 터치) 터진 자리에 파티클 애니메이션을 새로 띄운다.
  // 겹쳐 눌러도 자연스럽게 보이도록 매번 새 엘리먼트를 만든다(하나를 재사용하면 처음부터 다시 재생되지 않음).
  const pushTapEffect = useCallback((x: number, y: number, forTeam: TeamId) => {
    const id = tapEffectId.current++;
    setTapEffects((f) => [...f.slice(-14), { id, x, y, src: TAP_EFFECT_SRC[forTeam] }]);
    window.setTimeout(() => setTapEffects((f) => f.filter((n) => n.id !== id)), TAP_EFFECT_DURATION_MS);
  }, []);

  const handleTap = useCallback(
    (clientX: number, clientY: number) => {
      if (!ready) return;
      unlockAudio();
      const now = Date.now();

      // 서버도 같은 상한을 적용하므로, 넘겨봐야 인정되지 않는다.
      tapWindow.current = tapWindow.current.filter((t) => now - t < 1000);
      if (tapWindow.current.length >= MAX_TAPS_PER_SECOND) return;
      tapWindow.current.push(now);

      const nextCombo = now - lastTapAt.current <= COMBO_WINDOW_MS ? Math.min(combo + 1, COMBO_MAX) : 1;
      lastTapAt.current = now;
      setCombo(nextCombo);

      pendingTaps.current += 1;
      setContrib((c) => {
        const next = c + 1;
        window.localStorage.setItem(`${CONTRIB_KEY}.${team}`, String(next));
        return next;
      });

      // 낙관적 반영 — 서버가 실제로 인정하는 값과 같은 공식을 쓴다.
      const current = swordStateRef.current;
      const feverNow = isFeverActive(current, now);
      const gain =
        tapPower(current) * rateBonus(tapWindow.current.length, 1) * (feverNow ? FEVER_MULTIPLIER : 1);
      setSword((prev) => ({
        ...prev,
        energy: prev.energy + gain,
        lifetime: prev.lifetime + gain,
        taps: prev.taps + 1,
        feverGauge: prev.feverUntil > now ? prev.feverGauge : Math.min(prev.feverGauge + 1, FEVER_MAX),
      }));

      const rect = swordRef.current?.getBoundingClientRect();
      if (rect) {
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        pushFloater(x, y, `+${formatNumber(gain)}`, feverNow);
        pushTapEffect(x, y, team);
      }

      setHitting(true);
      window.setTimeout(() => setHitting(false), 90);
      playHit(team, stageOf(current.lifetime));
      if (navigator.vibrate) navigator.vibrate(nextCombo > 30 ? 12 : 8);
    },
    [combo, ready, pushFloater, pushTapEffect, team]
  );

  const buy = useCallback(
    async (id: string) => {
      try {
        const outcome = await buyUpgrade(team, id);
        setSword(outcome.state);
        if (outcome.ok && navigator.vibrate) navigator.vibrate(15);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [team]
  );

  const stageName = theme.stages[Math.min(stage, theme.stages.length - 1)];
  const cards = useMemo(() => cardsFor(team, theme.stages), [team, theme.stages]);
  const bonusCard = useMemo(() => bonusCardFor(team, theme.stages), [team, theme.stages]);
  const bgImage = `/images/bg/bg-${team}-${bgmGroupSuffix(bgmGroup)}.webp`;
  const gameBgStyle = {
    backgroundImage: `radial-gradient(66% 50% at 50% 44%, rgba(5,2,8,0.68), rgba(5,2,8,0.15) 70%), linear-gradient(180deg, rgba(5,2,8,0.62) 0%, rgba(5,2,8,0.42) 35%, rgba(5,2,8,0.60) 70%, rgba(5,2,8,0.88) 100%), url("${bgImage}")`,
  };
  const feverPct = useMemo(
    () => Math.min((sword.feverGauge / FEVER_MAX) * 100, 100),
    [sword.feverGauge]
  );
  // 피버 중엔 남은 시간에 비례해 게이지가 오른쪽→왼쪽으로 줄어들며 카운트다운한다.
  const feverRemainRatio = feverActive
    ? Math.max(0, Math.min(1, (sword.feverUntil - Date.now()) / FEVER_DURATION_MS))
    : 0;
  const feverFillWidth = feverActive ? feverRemainRatio * 100 : feverPct;

  const starsCapped = Math.min(stars, 5);
  const stageHintText = progress.starsMaxed
    ? theme.copy.stageHintMax ?? "모든 별을 다 모았습니다."
    : `${theme.copy.stageHintNext ?? "다음 단계까지"} ${formatNumber(Math.max(progress.to - sword.lifetime, 0))}`;

  return (
    <div className={`game ${feverActive ? "is-fever" : ""}`} style={gameBgStyle}>
      <div className="bg-orbs" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="hud">
        <div className="hud-row">
          <button
            className="team-badge"
            onClick={onChangeTeam}
            aria-label={`지금은 ${theme.short} 공동 칼. 눌러서 편 바꾸기`}
          >
            <img className="badge-emblem" src={emblemSrc(team, isMaxStage)} alt="" />
            <span className="badge-text">{theme.copy.badgeLabel ?? `${theme.short} 공동 칼`}</span>
            <span className="badge-swap" aria-hidden="true">
              ⇄
            </span>
          </button>
          <div className="hud-right">
            <div className="online" title={`${theme.short} 칼을 함께 보고 있는 사람`}>
              <span className="online-dot" />
              <span className="online-count">{online > 0 ? formatNumber(online) : "—"}</span>
              <span className="online-label">명 접속</span>
            </div>
            <button className="icon-btn" onClick={() => setGalleryOpen(true)} aria-label="칼 도감 열기">
              <img src={GALLERY_ICON_SRC[team]} width={24} height={24} alt="" />
            </button>
            <button
              className="icon-btn"
              onClick={() => {
                const next = !sfxOn;
                setSfxOn(next);
                setSfxEnabled(next);
              }}
              aria-label="소리 켜기/끄기"
            >
              {sfxOn && isSfxEnabled() ? "🔊" : "🔇"}
            </button>
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="환경설정 열기">
              ⚙️
            </button>
          </div>
        </div>

        <div className="energy">
          <span className="energy-value">{formatNumber(sword.energy)}</span>
          <span className="energy-label">{theme.spirit}</span>
        </div>
        <div className="energy-rate">
          초당 {formatRate(perSec * (feverActive ? FEVER_MULTIPLIER : 1))} · 터치당{" "}
          {formatRate(perTap * (feverActive ? FEVER_MULTIPLIER : 1))}
        </div>

        <div className="stage-bar">
          <div className="stage-bar-head">
            <span className="stage-name">
              {stageName}
              {starsCapped > 0 && <em className="stars">{"★".repeat(starsCapped)}</em>}
            </span>
            <span className="stage-pct">{Math.floor(progress.ratio * 100)}%</span>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${Math.min(progress.ratio * 100, 100)}%` }} />
          </div>
          <div className="stage-hint">{stageHintText}</div>
        </div>
      </header>

      <main className="stage-area">
        {combo > 1 && (
          <div className="combo" key={combo}>
            <span className="combo-num">{combo}</span>
            <span className="combo-label">COMBO</span>
          </div>
        )}

        <div
          ref={swordRef}
          className={`sword-hit ${hitting ? "hit" : ""}`}
          onPointerDown={(e) => {
            e.preventDefault();
            handleTap(e.clientX, e.clientY);
          }}
          role="button"
          tabIndex={0}
          aria-label="칼 두드리기"
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              const r = swordRef.current?.getBoundingClientRect();
              handleTap((r?.left ?? 0) + (r?.width ?? 0) / 2, (r?.top ?? 0) + (r?.height ?? 0) / 2);
            }
          }}
        >
          {starsCapped > 0 && (
            <span
              className="sword-aura"
              aria-hidden="true"
              style={
                {
                  width: AURA_SIZE[starsCapped],
                  height: AURA_SIZE[starsCapped],
                  "--aura-min": AURA_PEAK[starsCapped] * 0.55,
                  "--aura-max": AURA_PEAK[starsCapped],
                } as React.CSSProperties
              }
            />
          )}
          <Sword stage={stage} theme={theme} fever={feverActive} scale={SWORD_STAGE_SCALE[stage] ?? 1} />
          {tapEffects.map((e) => (
            <img
              key={e.id}
              className="tap-effect"
              src={e.src}
              alt=""
              aria-hidden="true"
              style={{ left: e.x, top: e.y }}
            />
          ))}
          {floaters.map((f) => (
            <span key={f.id} className={`floater ${f.fever ? "fever" : ""}`} style={{ left: f.x, top: f.y }}>
              {f.text}
            </span>
          ))}
        </div>

        <p className="tap-hint">
          {ready
            ? theme.copy.tapHint?.(formatNumber(sword.taps)) ?? `${theme.short} 전체가 두드린 ${formatNumber(sword.taps)}번`
            : "칼을 불러오는 중…"}
        </p>
        <p className="contrib">{theme.copy.contribLine?.(formatNumber(contrib)) ?? `내가 보탠 ${formatNumber(contrib)}번`}</p>
      </main>

      <footer className="dock">
        <div className={`fever-bar ${feverActive ? "active" : ""}`}>
          <span className="fever-fill" style={{ width: `${feverFillWidth}%` }} />
          <span className="fever-text">
            {feverActive
              ? theme.copy.feverActiveText ?? `응원 열기! 전원 ${FEVER_MULTIPLIER}배`
              : theme.copy.feverIdle?.(Math.floor(feverPct)) ?? `함께 채우는 응원 열기 ${Math.floor(feverPct)}%`}
          </span>
        </div>

        <button className="upgrade-btn" onClick={() => setSheetOpen(true)} disabled={!ready}>
          {theme.copy.upgradeBtnLabel ?? "함께 강화하기"}
        </button>
      </footer>

      {sheetOpen && (
        <UpgradeSheet
          sword={sword}
          theme={theme}
          onBuy={buy}
          onClose={() => setSheetOpen(false)}
          contrib={contrib}
        />
      )}

      {revealCard && <CardReveal card={revealCard} theme={theme} onClose={() => setRevealCard(null)} />}

      {galleryOpen && (
        <CardGallery
          cards={cards}
          bonusCard={bonusCard}
          stage={stage}
          stars={stars}
          theme={theme}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}

      {cutsceneOpen && <EvolveCutscene team={team} onDone={() => setCutsceneOpen(false)} />}

      {feverPopKey > 0 && (
        <FeverPop key={feverPopKey} team={team} stage={stage} onDone={() => setFeverPopKey(0)} />
      )}

      {error && (
        <div className="toast error">
          서버와 연결이 끊겼어요. 다시 시도하는 중…
          {backendMode === "local" && <em> (개발용 로컬 서버)</em>}
        </div>
      )}
    </div>
  );
}
