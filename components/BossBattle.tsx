"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  BOSS_BATTLE,
  BOSS_BATTLE_INTRO_LINE,
  BOSS_PHASE2,
  PHASE2_INTRO_LINE,
  Orientation,
  damageMultiplier,
  diagonalZoneClipPath,
  formatClock,
  pickDangerZones,
  pickOrientation,
  timingWindow,
  zoneOf,
} from "@/lib/bossBattle";

type Phase = "intro" | "combat" | "finale" | "checkpoint" | "result" | "blackout" | "phase2Intro";
type SubPhase = "idle" | "warn" | "active";
type Stage = 1 | 2;

interface Pattern1State {
  id: number;
  phase: SubPhase;
  orientation: Orientation;
  dangerZones: number[];
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
 * 발악(피니시) 타이밍 판정으로 끝난다. 발악 성공 시 2페이즈 등장 연출로 이어지고, 5분할
 * 맵·더 빨라진 시전속도·무작위 전체패턴·75/50/25% 체크포인트 발악을 거쳐 진짜 승리로
 * 마무리된다. 서버와 무관한 완전 로컬 미니게임이라 승패는 저장되지 않는다.
 */
export default function BossBattle({
  onExit,
  debugStartPhase2 = false,
}: {
  onExit: () => void;
  /** 개발용 — 전투를 건너뛰고 바로 2페이즈 등장 연출부터 보여준다(연출 후 자동으로 2페이즈 전투 진입). */
  debugStartPhase2?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(debugStartPhase2 ? "phase2Intro" : "intro");
  const [stage, setStage] = useState<Stage>(1);
  const [hp, setHp] = useState<number>(BOSS_BATTLE.maxHp);
  const [combo, setCombo] = useState(0);
  const [deathCount, setDeathCount] = useState<number>(BOSS_BATTLE.maxDeathCount);
  const [timeLeftMs, setTimeLeftMs] = useState(BOSS_BATTLE.timeLimitMs);
  const [p1, setP1] = useState<Pattern1State>(IDLE_PATTERN1);
  const [p2Phase, setP2Phase] = useState<SubPhase>("idle");
  const [flash, setFlash] = useState<{ key: number; kind: "hit" | "success" | "finale-fail" } | null>(null);

  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const phaseRef = useRef<Phase>(debugStartPhase2 ? "phase2Intro" : "intro");
  const stageRef = useRef<Stage>(1);
  const hpRef = useRef<number>(BOSS_BATTLE.maxHp);
  const comboRef = useRef(0);
  const deathCountRef = useRef<number>(BOSS_BATTLE.maxDeathCount);
  const lastTapAtRef = useRef(0);
  const battleStartRef = useRef(0);
  const finaleStartRef = useRef(0);
  const checkpointStartRef = useRef(0);
  const inPattern2Ref = useRef(false);
  const inCheckpointRef = useRef(false);
  const p1Ref = useRef<Pattern1State>(IDLE_PATTERN1);
  const crossedThresholds = useRef<Set<number>>(new Set());
  const crossedCheckpoints = useRef<Set<number>>(new Set());
  const flashId = useRef(0);
  const slashId = useRef(0);
  const wonRef = useRef(false);
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
    (win: boolean, flashKind?: "hit" | "success" | "finale-fail") => {
      if (phaseRef.current === "result" || phaseRef.current === "blackout") return;
      clearPendingTimers();
      wonRef.current = win;
      phaseRef.current = "result";
      setPhase("result");
      const kind = flashKind ?? (win ? "success" : "hit");
      triggerFlash(kind);
      // 승패 텍스트 없이, 이펙트가 다 보인 뒤 화면이 암전된다. 1페이즈에서 이겼으면 암전 뒤
      // 2페이즈 등장으로, 2페이즈에서 이겼으면 그게 곧 진짜 승리라 입장맵으로, 실패/시간초과/
      // 죽음이면 그대로 입장맵으로 돌아간다.
      const effectMs = kind === "success" ? 900 : kind === "finale-fail" ? 600 : 350;
      const t = window.setTimeout(() => {
        phaseRef.current = "blackout";
        setPhase("blackout");
      }, effectMs + 150);
      pendingTimers.current.push(t);
    },
    [clearPendingTimers, triggerFlash]
  );

  const enterFinale = useCallback(() => {
    clearPendingTimers();
    inPattern2Ref.current = false;
    inCheckpointRef.current = false;
    p1Ref.current = IDLE_PATTERN1;
    setP1(IDLE_PATTERN1);
    setP2Phase("idle");
    phaseRef.current = "finale";
    setPhase("finale");
    finaleStartRef.current = Date.now();
    const durationMs = stageRef.current === 1 ? BOSS_BATTLE.finaleRingDurationMs : BOSS_PHASE2.checkpointRingDurationMs;
    const windowMs = stageRef.current === 1 ? BOSS_BATTLE.finaleWindowMs : BOSS_PHASE2.checkpointWindowMs;
    const { end } = timingWindow(durationMs, windowMs);
    const timer = window.setTimeout(() => {
      if (phaseRef.current === "finale") endBattle(false, "finale-fail");
    }, end + 60);
    pendingTimers.current.push(timer);
  }, [clearPendingTimers, endBattle]);

  const registerPatternHit = useCallback(
    (penalty: number) => {
      // 한 번 맞으면 판정을 즉시 꺼서, 피격 이펙트가 나오는 동안 연타해도 중복으로
      // 맞지 않게 한다(패턴1 위험구역이든 패턴2 전체판정이든 동일하게 즉시 해제).
      p1Ref.current = IDLE_PATTERN1;
      setP1(IDLE_PATTERN1);
      inPattern2Ref.current = false;
      setP2Phase("idle");

      const next = Math.max(0, deathCountRef.current - penalty);
      deathCountRef.current = next;
      setDeathCount(next);
      comboRef.current = 0;
      setCombo(0);
      triggerFlash("hit");
      if (next <= 0) endBattle(false);
    },
    [endBattle, triggerFlash]
  );

  const resolveCheckpoint = useCallback(
    (success: boolean) => {
      if (phaseRef.current !== "checkpoint") return;
      inCheckpointRef.current = false;
      if (success) {
        triggerFlash("success");
      } else {
        triggerFlash("finale-fail");
        comboRef.current = 0;
        setCombo(0);
        const next = Math.max(0, deathCountRef.current - BOSS_PHASE2.checkpointFailPenalty);
        deathCountRef.current = next;
        setDeathCount(next);
        if (next <= 0) {
          endBattle(false);
          return;
        }
      }
      lastTapAtRef.current = Date.now();
      phaseRef.current = "combat";
      setPhase("combat");
    },
    [endBattle, triggerFlash]
  );

  /** 2페이즈 전용 — HP 75/50/25% 체크포인트. 발악과 같은 연출이지만 끝나도 전투가 이어진다. */
  const enterCheckpoint = useCallback(() => {
    clearPendingTimers();
    inPattern2Ref.current = false;
    inCheckpointRef.current = true;
    p1Ref.current = IDLE_PATTERN1;
    setP1(IDLE_PATTERN1);
    setP2Phase("idle");
    phaseRef.current = "checkpoint";
    setPhase("checkpoint");
    checkpointStartRef.current = Date.now();
    const { end } = timingWindow(BOSS_PHASE2.checkpointRingDurationMs, BOSS_PHASE2.checkpointWindowMs);
    const timer = window.setTimeout(() => resolveCheckpoint(false), end + 60);
    pendingTimers.current.push(timer);
  }, [clearPendingTimers, resolveCheckpoint]);

  const triggerPattern2 = useCallback(() => {
    if (inCheckpointRef.current) return; // 체크포인트 중엔 전체패턴이 끼어들지 않는다.
    inPattern2Ref.current = true;
    setP2Phase("warn");
    // 겹침 방지 규칙 2 — 진행 중이던 패턴1을 즉시 idle로 되돌린다.
    p1Ref.current = IDLE_PATTERN1;
    setP1(IDLE_PATTERN1);

    const warnMs = stageRef.current === 1 ? BOSS_BATTLE.pattern2WarnMs : BOSS_PHASE2.pattern2WarnMs;
    const activeMs = stageRef.current === 1 ? BOSS_BATTLE.pattern2ActiveMs : BOSS_PHASE2.pattern2ActiveMs;

    const warnTimer = window.setTimeout(() => {
      setP2Phase("active");
      const activeTimer = window.setTimeout(() => {
        setP2Phase("idle");
        inPattern2Ref.current = false;
        lastTapAtRef.current = Date.now(); // 재개 시 콤보 유예시간을 새로 준다
      }, activeMs);
      pendingTimers.current.push(activeTimer);
    }, warnMs);
    pendingTimers.current.push(warnTimer);
  }, []);

  /** 2페이즈 전용 — 전체패턴을 HP 임계값이 아니라 무작위 주기로 반복 예약한다. */
  const scheduleStage2Pattern2 = useCallback(() => {
    const delay =
      BOSS_PHASE2.pattern2RandomMinMs + Math.random() * (BOSS_PHASE2.pattern2RandomMaxMs - BOSS_PHASE2.pattern2RandomMinMs);
    const timer = window.setTimeout(() => {
      if (phaseRef.current === "combat" && stageRef.current === 2 && !inPattern2Ref.current && !inCheckpointRef.current) {
        triggerPattern2();
      }
      if (phaseRef.current === "combat" || phaseRef.current === "checkpoint") {
        scheduleStage2Pattern2();
      }
    }, delay);
    pendingTimers.current.push(timer);
  }, [triggerPattern2]);

  const checkHpThresholds = useCallback(
    (nextHp: number) => {
      if (inPattern2Ref.current || inCheckpointRef.current) return; // 겹침 방지 규칙 1
      if (stageRef.current === 1) {
        for (const t of BOSS_BATTLE.pattern2Thresholds) {
          const absolute = t * BOSS_BATTLE.maxHp;
          if (nextHp < absolute && !crossedThresholds.current.has(t)) {
            crossedThresholds.current.add(t);
            triggerPattern2();
            break;
          }
        }
      } else {
        for (const t of BOSS_PHASE2.checkpointThresholds) {
          const absolute = t * BOSS_PHASE2.maxHp;
          if (nextHp < absolute && !crossedCheckpoints.current.has(t)) {
            crossedCheckpoints.current.add(t);
            enterCheckpoint();
            break;
          }
        }
      }
    },
    [triggerPattern2, enterCheckpoint]
  );

  const triggerPattern1 = useCallback(() => {
    if (inPattern2Ref.current || inCheckpointRef.current) return;
    const zoneCount = stageRef.current === 1 ? BOSS_BATTLE.zoneCount : BOSS_PHASE2.zoneCount;
    const dangerZoneCount = stageRef.current === 1 ? BOSS_BATTLE.dangerZoneCount : BOSS_PHASE2.dangerZoneCount;
    const warnMs = stageRef.current === 1 ? BOSS_BATTLE.pattern1WarnMs : BOSS_PHASE2.pattern1WarnMs;
    const activeMs = stageRef.current === 1 ? BOSS_BATTLE.pattern1ActiveMs : BOSS_PHASE2.pattern1ActiveMs;
    const orientation = pickOrientation();
    const dangerZones = pickDangerZones(zoneCount, dangerZoneCount);
    slashId.current += 1;
    const warnState: Pattern1State = { id: slashId.current, phase: "warn", orientation, dangerZones };
    p1Ref.current = warnState;
    setP1(warnState);

    const warnTimer = window.setTimeout(() => {
      if (inPattern2Ref.current || inCheckpointRef.current) {
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
      }, activeMs);
      pendingTimers.current.push(activeTimer);
    }, warnMs);
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

      const pattern2Penalty = stageRef.current === 1 ? BOSS_BATTLE.pattern2DeathPenalty : BOSS_PHASE2.pattern2DeathPenalty;
      const pattern1Penalty = stageRef.current === 1 ? BOSS_BATTLE.pattern1DeathPenalty : BOSS_PHASE2.pattern1DeathPenalty;

      if (inPattern2Ref.current && p2Phase === "active") {
        registerPatternHit(pattern2Penalty);
        return;
      }
      if (p1Ref.current.phase === "active") {
        const zoneCount = stageRef.current === 1 ? BOSS_BATTLE.zoneCount : BOSS_PHASE2.zoneCount;
        const zone = zoneOf(p1Ref.current.orientation, xFrac, yFrac, zoneCount);
        if (p1Ref.current.dangerZones.includes(zone)) {
          registerPatternHit(pattern1Penalty);
          return;
        }
      }

      const now = Date.now();
      const prevCombo = comboRef.current;
      const nextCombo =
        now - lastTapAtRef.current <= BOSS_BATTLE.comboDecayMs
          ? Math.min(comboRef.current + 1, BOSS_BATTLE.maxCombo)
          : 1;
      lastTapAtRef.current = now;
      comboRef.current = nextCombo;
      setCombo(nextCombo);

      // 콤보를 50까지 채우면(도달하는 그 순간 한 번만) 목숨을 한 칸 회복한다.
      if (nextCombo === BOSS_BATTLE.maxCombo && prevCombo < BOSS_BATTLE.maxCombo) {
        const recovered = Math.min(BOSS_BATTLE.maxDeathCount, deathCountRef.current + 1);
        deathCountRef.current = recovered;
        setDeathCount(recovered);
      }

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
    const durationMs = stageRef.current === 1 ? BOSS_BATTLE.finaleRingDurationMs : BOSS_PHASE2.checkpointRingDurationMs;
    const windowMs = stageRef.current === 1 ? BOSS_BATTLE.finaleWindowMs : BOSS_PHASE2.checkpointWindowMs;
    const { start, end } = timingWindow(durationMs, windowMs);
    if (elapsed >= start && elapsed <= end) endBattle(true);
    else endBattle(false, "finale-fail");
  }, [endBattle]);

  const handleCheckpointSkill = useCallback(() => {
    if (phaseRef.current !== "checkpoint") return;
    const elapsed = Date.now() - checkpointStartRef.current;
    const { start, end } = timingWindow(BOSS_PHASE2.checkpointRingDurationMs, BOSS_PHASE2.checkpointWindowMs);
    resolveCheckpoint(elapsed >= start && elapsed <= end);
  }, [resolveCheckpoint]);

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

  // 2페이즈 등장 연출 3초 후, 이어서 2페이즈 전투 시작.
  useEffect(() => {
    if (phase !== "phase2Intro") return;
    const timer = window.setTimeout(() => {
      stageRef.current = 2;
      setStage(2);
      hpRef.current = BOSS_PHASE2.maxHp;
      setHp(BOSS_PHASE2.maxHp);
      comboRef.current = 0;
      setCombo(0);
      crossedCheckpoints.current = new Set();
      lastTapAtRef.current = Date.now();
      battleStartRef.current = Date.now();
      setTimeLeftMs(BOSS_PHASE2.timeLimitMs);
      phaseRef.current = "combat";
      setPhase("combat");
      scheduleStage2Pattern2();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [phase, scheduleStage2Pattern2]);

  // 패턴1 반복 스케줄러 — 2페이즈는 더 빠른 주기로 돈다.
  useEffect(() => {
    if (phase !== "combat") return;
    const intervalMs = stage === 1 ? BOSS_BATTLE.pattern1IntervalMs : BOSS_PHASE2.pattern1IntervalMs;
    const interval = window.setInterval(() => triggerPattern1(), intervalMs);
    return () => window.clearInterval(interval);
  }, [phase, stage, triggerPattern1]);

  // 콤보 자동 초기화(1.5초 무입력) — 패턴2/체크포인트 진행 중에는 멈춘다.
  useEffect(() => {
    if (phase !== "combat") return;
    const interval = window.setInterval(() => {
      if (inPattern2Ref.current || inCheckpointRef.current) return;
      if (comboRef.current > 0 && Date.now() - lastTapAtRef.current > BOSS_BATTLE.comboDecayMs) {
        comboRef.current = 0;
        setCombo(0);
      }
    }, 150);
    return () => window.clearInterval(interval);
  }, [phase]);

  // 제한시간 3분 카운트다운 — 발악/체크포인트 중에도 계속 흐른다.
  useEffect(() => {
    if (phase !== "combat" && phase !== "finale" && phase !== "checkpoint") return;
    const interval = window.setInterval(() => {
      const timeLimitMs = stageRef.current === 1 ? BOSS_BATTLE.timeLimitMs : BOSS_PHASE2.timeLimitMs;
      const left = Math.max(0, timeLimitMs - (Date.now() - battleStartRef.current));
      setTimeLeftMs(left);
      if (left <= 0) endBattle(false);
    }, 500);
    return () => window.clearInterval(interval);
  }, [phase, endBattle]);

  // 화면이 다 어두워지면: 1페이즈 발악 성공은 2페이즈 등장으로, 2페이즈 발악 성공은 진짜
  // 승리라 그대로 입장맵으로, 그 외(실패/시간초과/죽음)는 전부 입장맵으로 돌아간다.
  useEffect(() => {
    if (phase !== "blackout") return;
    const t = window.setTimeout(() => {
      if (wonRef.current && stageRef.current === 1) {
        phaseRef.current = "phase2Intro";
        setPhase("phase2Intro");
      } else {
        onExitRef.current();
      }
    }, 650);
    return () => window.clearTimeout(t);
  }, [phase]);

  // 언마운트 시 남아있는 타이머 정리.
  useEffect(() => () => clearPendingTimers(), [clearPendingTimers]);

  const showCombat = phase === "combat" || phase === "finale" || phase === "checkpoint";
  const maxHp = stage === 1 ? BOSS_BATTLE.maxHp : BOSS_PHASE2.maxHp;
  const zoneCount = stage === 1 ? BOSS_BATTLE.zoneCount : BOSS_PHASE2.zoneCount;

  return (
    <section className="bb-root boss-theme" role="dialog" aria-modal="true" aria-label="서휘령과의 전투">
      <div className="bb-bg" />
      <img className="bb-boss-sword" src="/images/boss/boss-map-sword.webp" alt="" aria-hidden />

      {phase === "intro" && (
        <div className="bb-intro">
          <p className="bb-intro-line">{BOSS_BATTLE_INTRO_LINE}</p>
        </div>
      )}

      {phase === "phase2Intro" && (
        <div className="bb-intro bb-phase2-intro">
          <img className="bb-phase2-image" src="/images/boss-battle/phase2-reveal.png" alt="" />
          <p className="bb-intro-line">{PHASE2_INTRO_LINE}</p>
        </div>
      )}

      {showCombat && (
        <>
          <header className="bb-hud">
            <div className="bb-hp-row">
              <div className="bb-hp-bar">
                <div className="bb-hp-fill" style={{ width: `${Math.max(0, (hp / maxHp) * 100)}%` }} />
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
                {Array.from({ length: zoneCount }, (_, z) => z).map((z) => (
                  <div
                    key={z}
                    data-orient={p1.orientation}
                    data-zone={z}
                    className={`bb-zone ${
                      p1.dangerZones.includes(z) ? `bb-zone--danger bb-zone--${p1.phase}` : ""
                    }`}
                    style={p1.orientation === "diagonal" ? { clipPath: diagonalZoneClipPath(z, zoneCount) } : undefined}
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

      {(phase === "finale" || phase === "checkpoint") && (
        <div className="bb-finale-layer">
          <p className="bb-finale-line">지금이다 — 정확한 순간에 맞춰라</p>
          <div className="bb-finale-rings">
            <div className="bb-finale-ring-target" />
            <div className="bb-finale-ring-shrink" />
          </div>
          <button
            className="bb-skill-btn"
            onClick={phase === "finale" ? handleFinaleSkill : handleCheckpointSkill}
            aria-label="특수 스킬 사용"
          >
            <img className="bb-skill-icon" src="/images/boss-battle/skill-bind.png" alt="" />
          </button>
        </div>
      )}

      {flash && flash.kind === "finale-fail" && (
        <img key={flash.key} className="bb-flash bb-flash--finale-fail" src="/images/boss-battle/finale-fail-sweep.png" alt="" />
      )}
      {flash && flash.kind === "success" && (
        <Fragment key={flash.key}>
          <div className="bb-flash bb-flash--success-white" />
          <img className="bb-flash bb-flash--success" src="/images/boss-battle/skill-success.png" alt="" />
        </Fragment>
      )}
      {flash && flash.kind === "hit" && <div key={flash.key} className="bb-flash bb-flash--hit" />}

      {phase === "blackout" && <div className="bb-blackout" />}
    </section>
  );
}
