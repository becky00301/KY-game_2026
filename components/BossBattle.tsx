"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BOSS_BATTLE,
  BOSS_BATTLE_INTRO_LINE,
  Orientation,
  ZoneIndex,
  damageMultiplier,
  finaleWindow,
  formatClock,
  pickDangerZones,
  pickOrientation,
  zoneOf,
} from "@/lib/bossBattle";

type Phase = "intro" | "combat" | "finale" | "result";
type SubPhase = "idle" | "warn" | "active";

interface Pattern1State {
  id: number;
  phase: SubPhase;
  orientation: Orientation;
  dangerZones: ZoneIndex[];
}

interface Result {
  win: boolean;
  reason: string;
}

const IDLE_PATTERN1: Pattern1State = { id: 0, phase: "idle", orientation: "vertical", dangerZones: [] };

/** 판정 구간(active)에 뜨는 검격 이펙트 — 방향별 전용 일러스트. */
const SLASH_SRC: Record<Orientation, string> = {
  diagonal: "/images/boss-battle/slash-diagonal.png",
  horizontal: "/images/boss-battle/slash-horizontal.png",
  vertical: "/images/boss-battle/slash-vertical.png",
};

/**
 * 서휘령 실전 전투 — 3초 암전 대사로 시작해, 콤보 기반 딜링과 두 가지 회피 패턴을 거쳐
 * 발악(피니시) 타이밍 판정으로 끝난다. 서버와 무관한 완전 로컬 미니게임이라 승패는
 * 저장되지 않는다.
 */
export default function BossBattle({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [hp, setHp] = useState<number>(BOSS_BATTLE.maxHp);
  const [combo, setCombo] = useState(0);
  const [deathCount, setDeathCount] = useState<number>(BOSS_BATTLE.maxDeathCount);
  const [timeLeftMs, setTimeLeftMs] = useState(BOSS_BATTLE.timeLimitMs);
  const [p1, setP1] = useState<Pattern1State>(IDLE_PATTERN1);
  const [p2Phase, setP2Phase] = useState<SubPhase>("idle");
  const [flash, setFlash] = useState<{ key: number; kind: "hit" | "success" | "finale-fail" } | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const phaseRef = useRef<Phase>("intro");
  const hpRef = useRef<number>(BOSS_BATTLE.maxHp);
  const comboRef = useRef(0);
  const deathCountRef = useRef<number>(BOSS_BATTLE.maxDeathCount);
  const lastTapAtRef = useRef(0);
  const battleStartRef = useRef(0);
  const finaleStartRef = useRef(0);
  const inPattern2Ref = useRef(false);
  const p1Ref = useRef<Pattern1State>(IDLE_PATTERN1);
  const crossedThresholds = useRef<Set<number>>(new Set());
  const flashId = useRef(0);
  const slashId = useRef(0);
  const tapAreaRef = useRef<HTMLButtonElement>(null);
  const pendingTimers = useRef<number[]>([]);

  const clearPendingTimers = useCallback(() => {
    pendingTimers.current.forEach((id) => window.clearTimeout(id));
    pendingTimers.current = [];
  }, []);

  const triggerFlash = useCallback((kind: "hit" | "success" | "finale-fail") => {
    flashId.current += 1;
    setFlash({ key: flashId.current, kind });
  }, []);

  const endBattle = useCallback(
    (win: boolean, reason: string, flashKind?: "hit" | "success" | "finale-fail") => {
      if (phaseRef.current === "result") return;
      clearPendingTimers();
      phaseRef.current = "result";
      setPhase("result");
      setResult({ win, reason });
      triggerFlash(flashKind ?? (win ? "success" : "hit"));
    },
    [clearPendingTimers, triggerFlash]
  );

  const enterFinale = useCallback(() => {
    clearPendingTimers();
    inPattern2Ref.current = false;
    p1Ref.current = IDLE_PATTERN1;
    setP1(IDLE_PATTERN1);
    setP2Phase("idle");
    phaseRef.current = "finale";
    setPhase("finale");
    finaleStartRef.current = Date.now();
    const { end } = finaleWindow();
    const timer = window.setTimeout(() => {
      if (phaseRef.current === "finale") endBattle(false, "빈틈을 놓쳤다", "finale-fail");
    }, end + 60);
    pendingTimers.current.push(timer);
  }, [clearPendingTimers, endBattle]);

  const registerPatternHit = useCallback(
    (penalty: number) => {
      const next = Math.max(0, deathCountRef.current - penalty);
      deathCountRef.current = next;
      setDeathCount(next);
      comboRef.current = 0;
      setCombo(0);
      triggerFlash("hit");
      if (next <= 0) endBattle(false, "목숨을 모두 잃었다");
    },
    [endBattle, triggerFlash]
  );

  const triggerPattern2 = useCallback(() => {
    inPattern2Ref.current = true;
    setP2Phase("warn");
    // 겹침 방지 규칙 2 — 진행 중이던 패턴1을 즉시 idle로 되돌린다.
    p1Ref.current = IDLE_PATTERN1;
    setP1(IDLE_PATTERN1);

    const warnTimer = window.setTimeout(() => {
      setP2Phase("active");
      const activeTimer = window.setTimeout(() => {
        setP2Phase("idle");
        inPattern2Ref.current = false;
        lastTapAtRef.current = Date.now(); // 재개 시 콤보 유예시간을 새로 준다
      }, BOSS_BATTLE.pattern2ActiveMs);
      pendingTimers.current.push(activeTimer);
    }, BOSS_BATTLE.pattern2WarnMs);
    pendingTimers.current.push(warnTimer);
  }, []);

  const checkHpThresholds = useCallback(
    (nextHp: number) => {
      if (inPattern2Ref.current) return; // 겹침 방지 규칙 1
      for (const t of BOSS_BATTLE.pattern2Thresholds) {
        const absolute = t * BOSS_BATTLE.maxHp;
        if (nextHp < absolute && !crossedThresholds.current.has(t)) {
          crossedThresholds.current.add(t);
          triggerPattern2();
          break;
        }
      }
    },
    [triggerPattern2]
  );

  const triggerPattern1 = useCallback(() => {
    if (inPattern2Ref.current) return;
    const orientation = pickOrientation();
    const dangerZones = pickDangerZones();
    slashId.current += 1;
    const warnState: Pattern1State = { id: slashId.current, phase: "warn", orientation, dangerZones };
    p1Ref.current = warnState;
    setP1(warnState);

    const warnTimer = window.setTimeout(() => {
      if (inPattern2Ref.current) {
        // 겹침 방지 규칙 3 — 전환하지 않고 조용히 idle로.
        p1Ref.current = IDLE_PATTERN1;
        setP1(IDLE_PATTERN1);
        return;
      }
      const activeState: Pattern1State = { ...warnState, phase: "active" };
      p1Ref.current = activeState;
      setP1(activeState);
      const activeTimer = window.setTimeout(() => {
        p1Ref.current = IDLE_PATTERN1;
        setP1(IDLE_PATTERN1);
      }, BOSS_BATTLE.pattern1ActiveMs);
      pendingTimers.current.push(activeTimer);
    }, BOSS_BATTLE.pattern1WarnMs);
    pendingTimers.current.push(warnTimer);
  }, []);

  const handleTap = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (phaseRef.current !== "combat") return;
      e.preventDefault();
      const rect = tapAreaRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const xFrac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const yFrac = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

      if (inPattern2Ref.current && p2Phase === "active") {
        registerPatternHit(BOSS_BATTLE.pattern2DeathPenalty);
        return;
      }
      if (p1Ref.current.phase === "active") {
        const zone = zoneOf(p1Ref.current.orientation, xFrac, yFrac);
        if (p1Ref.current.dangerZones.includes(zone)) {
          registerPatternHit(BOSS_BATTLE.pattern1DeathPenalty);
          return;
        }
      }

      const now = Date.now();
      const nextCombo =
        now - lastTapAtRef.current <= BOSS_BATTLE.comboDecayMs
          ? Math.min(comboRef.current + 1, BOSS_BATTLE.maxCombo)
          : 1;
      lastTapAtRef.current = now;
      comboRef.current = nextCombo;
      setCombo(nextCombo);

      const mult = damageMultiplier(nextCombo);
      const nextHp = Math.max(0, hpRef.current - BOSS_BATTLE.baseDamage * mult);
      hpRef.current = nextHp;
      setHp(nextHp);

      if (nextHp <= 0) {
        enterFinale();
        return;
      }
      checkHpThresholds(nextHp);
    },
    [p2Phase, registerPatternHit, checkHpThresholds, enterFinale]
  );

  const handleFinaleSkill = useCallback(() => {
    if (phaseRef.current !== "finale") return;
    const elapsed = Date.now() - finaleStartRef.current;
    const { start, end } = finaleWindow();
    if (elapsed >= start && elapsed <= end) endBattle(true, "");
    else endBattle(false, "빈틈을 놓쳤다", "finale-fail");
  }, [endBattle]);

  const retry = useCallback(() => {
    clearPendingTimers();
    hpRef.current = BOSS_BATTLE.maxHp;
    comboRef.current = 0;
    deathCountRef.current = BOSS_BATTLE.maxDeathCount;
    lastTapAtRef.current = 0;
    inPattern2Ref.current = false;
    p1Ref.current = IDLE_PATTERN1;
    crossedThresholds.current = new Set();
    setHp(BOSS_BATTLE.maxHp);
    setCombo(0);
    setDeathCount(BOSS_BATTLE.maxDeathCount);
    setTimeLeftMs(BOSS_BATTLE.timeLimitMs);
    setP1(IDLE_PATTERN1);
    setP2Phase("idle");
    setFlash(null);
    setResult(null);
    phaseRef.current = "intro";
    setPhase("intro");
  }, [clearPendingTimers]);

  // 입장 암전 3초 후 전투 시작.
  useEffect(() => {
    if (phase !== "intro") return;
    const timer = window.setTimeout(() => {
      battleStartRef.current = Date.now();
      phaseRef.current = "combat";
      setPhase("combat");
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // 패턴1 반복 스케줄러.
  useEffect(() => {
    if (phase !== "combat") return;
    const interval = window.setInterval(() => triggerPattern1(), BOSS_BATTLE.pattern1IntervalMs);
    return () => window.clearInterval(interval);
  }, [phase, triggerPattern1]);

  // 콤보 자동 초기화(1.5초 무입력) — 패턴2 진행 중에는 멈춘다.
  useEffect(() => {
    if (phase !== "combat") return;
    const interval = window.setInterval(() => {
      if (inPattern2Ref.current) return;
      if (comboRef.current > 0 && Date.now() - lastTapAtRef.current > BOSS_BATTLE.comboDecayMs) {
        comboRef.current = 0;
        setCombo(0);
      }
    }, 150);
    return () => window.clearInterval(interval);
  }, [phase]);

  // 제한시간 3분 카운트다운.
  useEffect(() => {
    if (phase !== "combat" && phase !== "finale") return;
    const interval = window.setInterval(() => {
      const left = Math.max(0, BOSS_BATTLE.timeLimitMs - (Date.now() - battleStartRef.current));
      setTimeLeftMs(left);
      if (left <= 0) endBattle(false, "시간초과");
    }, 500);
    return () => window.clearInterval(interval);
  }, [phase, endBattle]);

  // 언마운트 시 남아있는 타이머 정리.
  useEffect(() => () => clearPendingTimers(), [clearPendingTimers]);

  const showCombat = phase === "combat" || phase === "finale";

  return (
    <section className="bb-root boss-theme" role="dialog" aria-modal="true" aria-label="서휘령과의 전투">
      <div className="bb-bg" />
      <img className="bb-boss-sword" src="/images/boss/boss-map-sword.webp" alt="" aria-hidden />

      {phase === "intro" && (
        <div className="bb-intro">
          <p className="bb-intro-line">{BOSS_BATTLE_INTRO_LINE}</p>
        </div>
      )}

      {showCombat && (
        <>
          <header className="bb-hud">
            <div className="bb-hp-row">
              <div className="bb-hp-bar">
                <div className="bb-hp-fill" style={{ width: `${Math.max(0, (hp / BOSS_BATTLE.maxHp) * 100)}%` }} />
              </div>
              <span className={`bb-timer ${timeLeftMs <= 20_000 ? "bb-timer-danger" : ""}`}>
                {formatClock(timeLeftMs)}
              </span>
            </div>
            <div className="bb-death-row" aria-label={`남은 목숨 ${deathCount} / ${BOSS_BATTLE.maxDeathCount}`}>
              {Array.from({ length: BOSS_BATTLE.maxDeathCount }).map((_, i) => (
                <img
                  key={i}
                  className={`bb-death-icon ${i >= deathCount ? "bb-death-icon--spent" : ""}`}
                  src="/images/boss-battle/death-count-icon.webp"
                  alt=""
                />
              ))}
            </div>
            {combo > 0 && <p className="bb-combo">{combo} 콤보</p>}
          </header>

          <button
            ref={tapAreaRef}
            className="bb-tap-area"
            onPointerDown={handleTap}
            disabled={phase !== "combat"}
            aria-label="검격 가하기"
          >
            {p1.phase !== "idle" && (
              <div className={`bb-zones bb-zones--${p1.orientation}`}>
                {([0, 1, 2] as ZoneIndex[]).map((z) => (
                  <div
                    key={z}
                    data-orient={p1.orientation}
                    data-zone={z}
                    className={`bb-zone ${
                      p1.dangerZones.includes(z) ? `bb-zone--danger bb-zone--${p1.phase}` : ""
                    }`}
                  />
                ))}
              </div>
            )}
            {p1.phase === "active" && (
              <img
                key={p1.id}
                className={`bb-slash bb-slash--${p1.orientation}`}
                src={SLASH_SRC[p1.orientation]}
                alt=""
              />
            )}
            {p2Phase !== "idle" && <div className={`bb-full-warning bb-full-warning--${p2Phase}`} />}
          </button>
        </>
      )}

      {phase === "finale" && (
        <div className="bb-finale-layer">
          <p className="bb-finale-line">지금이다 — 정확한 순간에 맞춰라</p>
          <div className="bb-finale-rings">
            <div className="bb-finale-ring-target" />
            <div className="bb-finale-ring-shrink" />
          </div>
          <button className="bb-skill-btn" onClick={handleFinaleSkill} aria-label="특수 스킬 사용">
            <img className="bb-skill-icon" src="/images/boss-battle/skill-bind.png" alt="" />
          </button>
        </div>
      )}

      {flash && flash.kind === "finale-fail" && (
        <img key={flash.key} className="bb-flash bb-flash--finale-fail" src="/images/boss-battle/finale-fail-sweep.png" alt="" />
      )}
      {flash && flash.kind !== "finale-fail" && (
        <div key={flash.key} className={`bb-flash bb-flash--${flash.kind}`} />
      )}

      {phase === "result" && result && (
        <div className="bb-result">
          <h2 className="bb-result-title">{result.win ? "서휘령을 밀어붙였다" : "패배했다"}</h2>
          {!result.win && <p className="bb-result-reason">{result.reason}</p>}
          <div className="bb-result-actions">
            {!result.win && (
              <button className="bb-result-retry" onClick={retry}>
                다시 도전하기
              </button>
            )}
            <button className="bb-result-exit" onClick={onExit}>
              나가기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
