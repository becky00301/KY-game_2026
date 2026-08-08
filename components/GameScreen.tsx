"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sword from "./Sword";
import UpgradeSheet from "./UpgradeSheet";
import {
  FEVER_MAX,
  FEVER_MULTIPLIER,
  MAX_TAPS_PER_SECOND,
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
import { TEAMS, formatNumber, formatRate } from "@/lib/game";
import {
  backendMode,
  buyUpgrade,
  clientId,
  fetchSword,
  sendTaps,
  subscribePresence,
  subscribeSword,
} from "@/lib/backend";
import { isSfxEnabled, playFanfare, playHit, setSfxEnabled, unlockAudio } from "@/lib/sfx";
import { TeamId } from "@/lib/game";

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  fever: boolean;
}

const COMBO_WINDOW_MS = 1_200;
const COMBO_MAX = 100;
const FLUSH_INTERVAL_MS = 1_000;
/** 내가 이 칼에 보탠 터치 수 (자랑용, 이 기기에만 저장) */
const CONTRIB_KEY = "kyg.contrib";

export default function GameScreen({ team, onChangeTeam }: { team: TeamId; onChangeTeam: () => void }) {
  const [sword, setSword] = useState<SwordState>(() => createSword(team));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [evolveTo, setEvolveTo] = useState<number | null>(null);
  const [feverBanner, setFeverBanner] = useState(false);
  const [sfxOn, setSfxOn] = useState(true);
  const [hitting, setHitting] = useState(false);
  const [contrib, setContrib] = useState(0);
  const [online, setOnline] = useState(0);

  const lastTapAt = useRef(0);
  const tapWindow = useRef<number[]>([]);
  const pendingTaps = useRef(0);
  const pendingSince = useRef(Date.now());
  const floaterId = useRef(0);
  const swordRef = useRef<HTMLDivElement>(null);
  const prevStage = useRef(0);
  const prevFeverUntil = useRef(0);
  const swordStateRef = useRef(sword);
  swordStateRef.current = sword;

  const theme = TEAMS[team];
  const stage = stageOf(sword.lifetime);
  const progress = stageProgress(sword.lifetime);
  const stars = starRank(sword.lifetime);
  const perTap = tapPower(sword);
  const perSec = autoPerSecond(sword);
  const feverActive = isFeverActive(sword);

  // 테마 색상 주입
  useEffect(() => {
    const root = document.documentElement;
    const c = theme.colors;
    root.style.setProperty("--primary", c.primary);
    root.style.setProperty("--primary-deep", c.primaryDeep);
    root.style.setProperty("--accent", c.accent);
    root.style.setProperty("--glow", c.glow);
    root.style.setProperty("--bg-from", c.bgFrom);
    root.style.setProperty("--bg-to", c.bgTo);
  }, [theme]);

  // 첫 로딩 + 다른 사람의 터치 구독
  useEffect(() => {
    let alive = true;
    setReady(false);
    setContrib(Number(window.localStorage.getItem(`${CONTRIB_KEY}.${team}`) ?? 0));

    fetchSword(team)
      .then((state) => {
        if (!alive) return;
        prevStage.current = stageOf(state.lifetime);
        prevFeverUntil.current = state.feverUntil;
        setSword(state);
        setReady(true);
        setError(null);
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

  // 진화 연출
  useEffect(() => {
    if (!ready) return;
    if (stage > prevStage.current) {
      prevStage.current = stage;
      setEvolveTo(stage);
      playFanfare();
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
      const t = setTimeout(() => setEvolveTo(null), 2400);
      return () => clearTimeout(t);
    }
    prevStage.current = stage;
  }, [stage, ready]);

  // 팀 전체 응원 열기 발동 알림
  useEffect(() => {
    if (!ready) return;
    if (sword.feverUntil > prevFeverUntil.current && sword.feverUntil > Date.now()) {
      prevFeverUntil.current = sword.feverUntil;
      setFeverBanner(true);
      playFanfare();
      if (navigator.vibrate) navigator.vibrate([20, 30, 20, 30, 60]);
      const t = setTimeout(() => setFeverBanner(false), 2200);
      return () => clearTimeout(t);
    }
    prevFeverUntil.current = Math.max(prevFeverUntil.current, sword.feverUntil);
  }, [sword.feverUntil, ready]);

  const pushFloater = useCallback((x: number, y: number, text: string, fever: boolean) => {
    const id = floaterId.current++;
    setFloaters((f) => [...f.slice(-14), { id, x, y, text, fever }]);
    window.setTimeout(() => setFloaters((f) => f.filter((n) => n.id !== id)), 900);
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
      if (rect) pushFloater(clientX - rect.left, clientY - rect.top, `+${formatNumber(gain)}`, feverNow);

      setHitting(true);
      window.setTimeout(() => setHitting(false), 90);
      playHit(nextCombo, feverNow);
      if (navigator.vibrate) navigator.vibrate(nextCombo > 30 ? 12 : 8);
    },
    [combo, ready, pushFloater, team]
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
  const feverPct = useMemo(
    () => Math.min((sword.feverGauge / FEVER_MAX) * 100, 100),
    [sword.feverGauge]
  );

  return (
    <div className={`game ${feverActive ? "is-fever" : ""}`}>
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
            <span className="badge-emblem">{theme.emblem}</span>
            <span className="badge-text">{theme.short} 공동 칼</span>
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
              {stars > 0 && <em className="stars">{"★".repeat(Math.min(stars, 5))}</em>}
            </span>
            <span className="stage-pct">{Math.floor(progress.ratio * 100)}%</span>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${Math.min(progress.ratio * 100, 100)}%` }} />
          </div>
          <div className="stage-hint">
            {progress.isMax
              ? `다음 별까지 ${formatNumber(Math.max(progress.to - sword.lifetime, 0))}`
              : `다음 진화까지 ${formatNumber(Math.max(progress.to - sword.lifetime, 0))}`}
          </div>
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
          <Sword stage={stage} theme={theme} fever={feverActive} />
          {floaters.map((f) => (
            <span key={f.id} className={`floater ${f.fever ? "fever" : ""}`} style={{ left: f.x, top: f.y }}>
              {f.text}
            </span>
          ))}
        </div>

        <p className="tap-hint">
          {ready ? `${theme.short} 전체가 두드린 ${formatNumber(sword.taps)}번` : "칼을 불러오는 중…"}
        </p>
        <p className="contrib">내가 보탠 {formatNumber(contrib)}번</p>
      </main>

      <footer className="dock">
        <div className={`fever-bar ${feverActive ? "active" : ""}`}>
          <span className="fever-fill" style={{ width: `${feverActive ? 100 : feverPct}%` }} />
          <span className="fever-text">
            {feverActive
              ? `응원 열기! 전원 ${FEVER_MULTIPLIER}배 ${Math.max(
                  Math.ceil((sword.feverUntil - Date.now()) / 1000),
                  0
                )}초`
              : `함께 채우는 응원 열기 ${Math.floor(feverPct)}%`}
          </span>
        </div>

        <button className="upgrade-btn" onClick={() => setSheetOpen(true)} disabled={!ready}>
          함께 강화하기
        </button>
      </footer>

      {sheetOpen && (
        <UpgradeSheet
          sword={sword}
          theme={theme}
          onBuy={buy}
          onClose={() => setSheetOpen(false)}
          onChangeTeam={onChangeTeam}
          contrib={contrib}
        />
      )}

      {evolveTo !== null && (
        <div className="evolve-overlay">
          <div className="evolve-card">
            <p className="evolve-kicker">{theme.short}의 칼이 진화했다</p>
            <h2 className="evolve-name">{theme.stages[Math.min(evolveTo, theme.stages.length - 1)]}</h2>
            <p className="evolve-sub">생산량 ×{Math.pow(1.5, evolveTo).toFixed(1)}</p>
          </div>
        </div>
      )}

      {feverBanner && (
        <div className="evolve-overlay">
          <div className="evolve-card">
            <p className="evolve-kicker">{theme.short} 전체</p>
            <h2 className="evolve-name">응원 열기!</h2>
            <p className="evolve-sub">10초간 모두의 획득량 ×{FEVER_MULTIPLIER}</p>
          </div>
        </div>
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
