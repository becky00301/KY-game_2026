"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  BOSS_BATTLE,
  BOSS_BATTLE_INTRO_LINE,
  BOSS_DEATH_TAUNT_LINES,
  BOSS_DEFEAT_EXIT_MS,
  BOSS_DEFEAT_LINE,
  BOSS_FINALE_READY_LINE,
  BOSS_FINALE_TRANSITION_MS,
  BOSS_INVERT_CIRCLE_DURATION_MS,
  BOSS_INVERT_CIRCLE_MISS_PENALTY,
  BOSS_INVERT_CIRCLE_SPAWN_INTERVAL_MS,
  BOSS_INVERT_CIRCLE_WINDOW_MS,
  BOSS_INVERT_LINE,
  BOSS_INVERT_START_HP,
  BOSS_INVERT_STUN_LINE,
  BOSS_INVERT_STUN_BUFFER_MS,
  BOSS_INVERT_STUN_MS,
  BOSS_INVERT_TRANSITION_MS,
  BOSS_LASER_ACTIVE_MS,
  BOSS_LASER_COUNT_MAX,
  BOSS_LASER_COUNT_MIN,
  BOSS_LASER_DEATH_PENALTY,
  BOSS_LASER_HIT_HALF_WIDTH_PX,
  BOSS_LASER_INTERVAL_MAX_MS,
  BOSS_LASER_INTERVAL_MIN_MS,
  BOSS_LASER_START_HP,
  BOSS_LASER_START_LINE,
  BOSS_LASER_WARN_MS,
  BOSS_LINE_DISPLAY_MS,
  BOSS_PATTERN_TAUNT_LINES,
  BOSS_PHASE2,
  BOSS_RANKING_HP_MULTIPLIER,
  BOSS_RANKING_PHASE2_TIME_LIMIT_MS,
  BOSS_SUCCESS_LINES,
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
import {
  BOSS_EPILOGUE_ENDING_IMAGE_MS,
  BOSS_EPILOGUE_ENDING_IMAGE_SRC,
  BOSS_EPILOGUE_LINES,
  BOSS_EPILOGUE_PORTRAITS,
  BOSS_PHASE2_ASSETS,
} from "@/lib/boss";
import { setBossBgmPhase2, stopBossBgm } from "@/lib/bgm";
import { startBossRankingSession, submitBossClear } from "@/lib/bossRanking";
import { playHit, playBossPattern1AttackSound } from "@/lib/sfx";

type Phase =
  | "intro"
  | "combat"
  | "finaleTransition"
  | "finale"
  | "result"
  | "blackout"
  | "phase2Intro"
  | "invertTransition"
  | "invertCircles"
  | "epilogue"
  | "epilogueImage";
type SubPhase = "idle" | "warn" | "active";
type Stage = 1 | 2;

interface Pattern1State {
  id: number;
  phase: SubPhase;
  /** phase가 "active"인 전체 구간 중, 실제로 맞을 수 있는 짧은 판정 순간인지. 나머지는
   * 이펙트만 보여주는 잔상 구간이라 안전하다. */
  judgeable: boolean;
  orientation: Orientation;
  /** 피격존 — judgeable인 순간에 여길 누르면 맞는다. */
  dangerZones: number[];
  /** 반드시 눌러야 하는 존(노란빛) — active인 동안 이 중 아무 곳이나 한 번은 눌러야
   * 한다. 못 누른 채로 active가 끝나면 맞는다. */
  mustHitZones: number[];
}

const IDLE_PATTERN1: Pattern1State = {
  id: 0,
  phase: "idle",
  judgeable: false,
  orientation: "vertical",
  dangerZones: [],
  mustHitZones: [],
};

/** 판정 구간(active)에 뜨는 검격 이펙트 — 방향별 전용 일러스트. */
const SLASH_SRC: Record<Orientation, string> = {
  diagonal: "/images/boss-battle/slash-diagonal.png",
  horizontal: "/images/boss-battle/slash-horizontal.png",
  vertical: "/images/boss-battle/slash-vertical.png",
};

/** 2페이즈 전용 — 같은 판정, 더 웅장해진 검격 이펙트. */
const SLASH_SRC_PHASE2: Record<Orientation, string> = {
  diagonal: "/images/boss-battle/slash-diagonal-phase2.png",
  horizontal: "/images/boss-battle/slash-horizontal-phase2.png",
  vertical: "/images/boss-battle/slash-vertical-phase2.png",
};

/** 1·2페이즈 공통 — 패턴2(전체판정) active 구간에 뜨는 화면 전체 공격 이펙트. */
const FULL_SLASH_SRC = "/images/boss-battle/full-slash-downstrike.png";

/** 거꾸로 패턴 — 빨간 원의 판정 반경(px). CSS의 원 지름(120px)에 약간의 여유를 더했다. */
const CIRCLE_HIT_RADIUS_PX = 72;

/**
 * 서휘령 실전 전투 — 3초 암전 대사로 시작해, 콤보 기반 딜링과 두 가지 회피 패턴을 거쳐
 * 발악(피니시) 타이밍 판정으로 끝난다. 발악 성공 시 2페이즈 등장 연출로 이어지고, 5분할
 * 맵·더 빨라진 시전속도·무작위 전체패턴·75/50/25% 체크포인트 발악을 거쳐 진짜 승리로
 * 마무리된다. 서버와 무관한 완전 로컬 미니게임이라 승패는 저장되지 않는다.
 */
export default function BossBattle({
  onExit,
  onVictoryEpilogueDone,
  rankingNickname = null,
  debugStartPhase2 = false,
  debugLowHp = false,
  debugStartEpilogue = false,
}: {
  onExit: () => void;
  /** 2페이즈(진짜 격파) 후일담 대화가 끝나는 순간(엔딩 이미지로 넘어가는 시점) 한 번
   * 호출된다 — 호출부(GameScreen 등)에서 팀별 서휘령 도감 "victory" 카드를 해금하는 데 쓴다. */
  onVictoryEpilogueDone?: () => void;
  /** 랭킹모드로 입장한 경우의 닉네임 — null이면 일반 모드(순위 기록 없음). 2페이즈를
   * 실제로 격파하는 순간 이 닉네임으로 순위표에 한 번 기록된다. 그 외 로직/패턴은
   * 일반 모드와 완전히 동일하다. */
  rankingNickname?: string | null;
  /** 개발용 — 전투를 건너뛰고 바로 2페이즈 등장 연출부터 보여준다(연출 후 자동으로 2페이즈 전투 진입). */
  debugStartPhase2?: boolean;
  /** 개발용 — 2페이즈 진입 시 HP를 10%로 시작해서 발악(HP 0%)까지 금방 도달하게 한다.
   * 거꾸로 패턴/레이저는 이미 지나간 것으로 치고 건너뛴다(발악 자체를 테스트하는 용도). */
  debugLowHp?: boolean;
  /** 개발용 — 전투를 완전히 건너뛰고 2페이즈 격파 후일담(대화+엔딩 이미지)부터 바로
   * 보여준다. debugStartPhase2/debugLowHp보다 우선한다. */
  debugStartEpilogue?: boolean;
}) {
  // 랭킹모드는 일반 모드와 패턴/로직은 완전히 같지만, 체력을 40% 늘리고(1·2페이즈 공통)
  // 그만큼 2페이즈 제한시간도 3분→6분으로 늘린다. 이 세 값 외에는 전부 일반 모드와 동일.
  const isRankingMode = Boolean(rankingNickname);
  const maxHp1 = isRankingMode ? Math.round(BOSS_BATTLE.maxHp * BOSS_RANKING_HP_MULTIPLIER) : BOSS_BATTLE.maxHp;
  const maxHp2 = isRankingMode ? Math.round(BOSS_PHASE2.maxHp * BOSS_RANKING_HP_MULTIPLIER) : BOSS_PHASE2.maxHp;
  const timeLimit2 = isRankingMode ? BOSS_RANKING_PHASE2_TIME_LIMIT_MS : BOSS_PHASE2.timeLimitMs;

  const [phase, setPhase] = useState<Phase>(
    debugStartEpilogue ? "epilogue" : debugStartPhase2 ? "phase2Intro" : "intro"
  );
  const [stage, setStage] = useState<Stage>(debugStartEpilogue ? 2 : 1);
  const [hp, setHp] = useState<number>(maxHp1);
  const [combo, setCombo] = useState(0);
  const [deathCount, setDeathCount] = useState<number>(BOSS_BATTLE.maxDeathCount);
  const [timeLeftMs, setTimeLeftMs] = useState(BOSS_BATTLE.timeLimitMs);
  const [p1, setP1] = useState<Pattern1State>(IDLE_PATTERN1);
  const [p2Phase, setP2Phase] = useState<SubPhase>("idle");
  /** 화면 표시용 — 패턴2가 지금 실제로 맞는 순간인지(p2JudgeableRef와 같은 값). */
  const [p2Judgeable, setP2Judgeable] = useState(false);
  /** 화면 표시용 — 이번 패턴1의 노란 존을 이미 눌렀는지(p1MustHitSatisfiedRef와 같은 값). */
  const [p1MustHitDone, setP1MustHitDone] = useState(false);
  const [flash, setFlash] = useState<{ key: number; kind: "hit" | "success" | "finale-fail" | "parry" } | null>(null);
  const [bossLine, setBossLine] = useState<{ key: number; text: string; kind: "taunt" | "success" } | null>(null);
  const [inverted, setInverted] = useState(false);
  // 거꾸로 패턴 성공 후 서휘령이 기절해 있는 동안 검이 노란빛으로 빛난다.
  const [stunned, setStunned] = useState(false);
  // 2페이즈 발악(리듬게임) — 지금까지 연속으로 성공한 패링 횟수.
  const [finaleHits, setFinaleHits] = useState(0);
  // 2페이즈 발악 — 매 박자 링이 화면에서 뜨는 위치를 중앙 기준 오프셋(px)으로 무작위
  // 이동시킨다. null이면(1페이즈, 혹은 아직 안 정해졌으면) 기본 중앙 위치 그대로.
  const [finaleRingOffset, setFinaleRingOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [circleTargets, setCircleTargets] = useState<{ key: number; xFrac: number; yFrac: number }[]>([]);
  // 원을 맞혔을 때 그 자리에 잠깐 떴다가 사라지는 초록빛 확인 표시 — 게임 로직과는
  // 무관한 순수 연출용이라 별도 상태로 둔다.
  const [hitEffects, setHitEffects] = useState<{ key: number; xFrac: number; yFrac: number }[]>([]);
  // 원을 놓쳤을 때 그 자리에 잠깐 남는 표시 — 화면 전체 플래시 대신 국소적으로만 보여준다.
  const [missEffects, setMissEffects] = useState<{ key: number; xFrac: number; yFrac: number }[]>([]);
  // 2페이즈 HP 25% 이하 — 다른 모든 패턴과 무관하게 겹쳐서 뜨는 얇은 레이저들(한 번에
  // 여러 가닥이 볼레이로 뜬다).
  const [laserBeams, setLaserBeams] = useState<
    { key: number; cxFrac: number; cyFrac: number; angleDeg: number; phase: "warn" | "active" }[]
  >([]);

  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const onVictoryEpilogueDoneRef = useRef(onVictoryEpilogueDone);
  onVictoryEpilogueDoneRef.current = onVictoryEpilogueDone;
  const rankingNicknameRef = useRef(rankingNickname);
  rankingNicknameRef.current = rankingNickname;
  // 랭킹모드 격파 신고 위조 방지용 1회용 토큰 — 전투 시작 시 발급받아 두었다가,
  // 실제로 격파했을 때만 함께 제출한다(서버가 최소 경과시간도 같이 검증한다).
  const rankingTokenRef = useRef<string | null>(null);

  // 2페이즈 격파 후일담 — 지금 보여주고 있는 대사 인덱스, 그리고 후일담을 이미 한 번
  // 끝냈는지(엔딩 이미지까지 봤는지) 여부. 후자는 blackout이 다시 한 번 더(엔딩 이미지
  // 다음) 일어날 때, 그게 후일담 시작이 아니라 진짜 종료임을 구분하는 데 쓴다.
  const [epilogueLine, setEpilogueLine] = useState(0);
  const epilogueLineRef = useRef(0);
  const epilogueDoneRef = useRef(false);

  const phaseRef = useRef<Phase>(
    debugStartEpilogue ? "epilogue" : debugStartPhase2 ? "phase2Intro" : "intro"
  );
  const stageRef = useRef<Stage>(debugStartEpilogue ? 2 : 1);
  const hpRef = useRef<number>(maxHp1);
  const comboRef = useRef(0);
  const deathCountRef = useRef<number>(BOSS_BATTLE.maxDeathCount);
  const lastTapAtRef = useRef(0);
  const battleStartRef = useRef(0);
  const finaleStartRef = useRef(0);
  // 2페이즈 발악(리듬게임) — 지금까지 연속으로 성공한 패링 횟수(state와 동일, 타이머
  // 콜백에서 동기적으로 읽기 위한 ref).
  const finaleHitsRef = useRef(0);
  // 지금 박자의 링 지속시간/판정창(ms) — 2페이즈는 매 박자 무작위로 다시 뽑는다.
  // handleFinaleSkill이 렌더 시점과 무관하게 항상 "이번 박자에 실제로 쓰인" 값을
  // 읽도록 ref로 들고 있는다.
  const finaleBeatDurationRef = useRef(0);
  const finaleBeatWindowRef = useRef(0);
  // 발악 스킬 버튼 — 한 번 쓰면 즉시 잠가서, 결과 연출이 나오는 동안 연타해도 중복으로
  // 처리되지 않게 한다.
  const skillLockRef = useRef(false);
  const inPattern2Ref = useRef(false);
  // 패턴2(전체판정)도 패턴1과 동일하게, active인 전체 구간 중 실제로 맞을 수 있는 짧은
  // 판정 순간만 true — 나머지는 이펙트만 보이는 잔상 구간이다.
  const p2JudgeableRef = useRef(false);
  // 거꾸로 패턴 — 화면이 뒤집힌 채로 빨간 원을 터치하는 구간인지.
  const invertedRef = useRef(false);
  // 거꾸로 패턴 진입은 한 번뿐 — 이미 지나갔으면 다시 안 뜬다.
  const invertCrossedRef = useRef(false);
  // 거꾸로 패턴 중 원을 하나라도 놓쳤는지 — 시퀀스가 다 끝난 시점에 이걸로 성공/사망을 가른다.
  const invertMissedRef = useRef(false);
  // 지금 떠 있는 원들의 정보 — 여러 개가 동시에 떠 있을 수 있다. state와 동일하지만
  // 타이머 콜백에서 최신값을 동기적으로 읽기 위해 ref로도 들고 있는다.
  const circleTargetsRef = useRef<{ key: number; xFrac: number; yFrac: number }[]>([]);
  const circleIdRef = useRef(0);
  // 새 원을 더 이상 띄우지 않을 시각 — 이 시각 이후로는 spawnCircle이 스스로를 다시
  // 예약하지 않는다(이미 떠 있는 원들은 각자의 타이머대로 마저 처리된다).
  const invertSeqEndAtRef = useRef(0);
  // 한 패턴이 끝난 직후 다른 패턴이 곧바로 겹쳐 나오지 않도록, 다음 패턴을 시작해도 되는
  // 최소 시각을 기록해둔다(피격/자연 종료 시마다 갱신).
  const nextPatternAllowedAtRef = useRef(0);
  const grantPatternRest = useCallback(() => {
    const restMs = stageRef.current === 1 ? BOSS_BATTLE.patternRestMs : BOSS_PHASE2.patternRestMs;
    nextPatternAllowedAtRef.current = Date.now() + restMs;
  }, []);
  // 거꾸로 패턴 기절 종료 후의 여유시간 전용 잠금 — nextPatternAllowedAtRef는 패턴이
  // 하나 끝날 때마다 grantPatternRest로 계속 짧게 덮어써지므로, 기절 여유시간만큼은
  // 이 값과 별개로 확실하게 패턴을 막기 위해 따로 둔다.
  const invertBufferUntilRef = useRef(0);
  const p1Ref = useRef<Pattern1State>(IDLE_PATTERN1);
  // 지금 패턴1의 "반드시 눌러야 하는 존"을 active 동안 한 번이라도 눌렀는지. 새 패턴1이
  // 시작될 때마다 false로 초기화된다.
  const p1MustHitSatisfiedRef = useRef(false);
  const crossedThresholds = useRef<Set<number>>(new Set());
  const flashId = useRef(0);
  const bossLineId = useRef(0);
  const slashId = useRef(0);
  // debugStartEpilogue로 바로 진입한 경우, 후일담 끝의 blackout이 패배 처리로
  // 새지 않도록 "이미 이긴 상태"로 맞춰둔다.
  const wonRef = useRef(debugStartEpilogue);
  const tapAreaRef = useRef<HTMLButtonElement>(null);
  const pendingTimers = useRef<number[]>([]);

  const clearPendingTimers = useCallback(() => {
    pendingTimers.current.forEach((id) => window.clearTimeout(id));
    pendingTimers.current = [];
  }, []);

  // 레이저 — 지금 떠 있는 레이저 정보(ref로도 들고 있어 타이머 콜백에서 즉시 읽는다).
  const laserBeamsRef = useRef<{ key: number; cxFrac: number; cyFrac: number; angleDeg: number; phase: "warn" | "active" }[]>(
    []
  );
  const laserIdRef = useRef(0);
  // 지금 떠 있는 볼레이의 식별자 — 중첩 타이머가 이미 정리된(혹은 다음) 볼레이를 잘못
  // 건드리지 않도록 확인하는 용도.
  const laserVolleyRef = useRef(0);
  // HP 25% 아래로 내려가면 한 번만 true가 되고, 그 뒤로는 HP가 다시 올라가도 계속 유지된다.
  const laserModeRef = useRef(false);
  // 레이저 타이머는 체크포인트/거꾸로 패턴 진입 시 clearPendingTimers로 같이 끊기면 안
  // 되므로(모든 패턴에 겹쳐서 계속 유지되어야 하니까), pendingTimers와 완전히 분리해서
  // 따로 관리한다. 전투가 끝날 때(endBattle)와 언마운트 시에만 정리한다.
  const laserTimers = useRef<number[]>([]);
  const clearLaserTimers = useCallback(() => {
    laserTimers.current.forEach((id) => window.clearTimeout(id));
    laserTimers.current = [];
  }, []);

  // 같은 종류의 피격 이펙트가 아주 짧은 간격으로 중복 호출되는 걸 막는 안전장치 —
  // 실제 서로 다른 패턴에 두 번 맞는 최소 간격(휴식시간+예고시간)보다 훨씬 짧은 700ms
  // 안에 같은 kind가 다시 들어오면 무시한다. 정상적인 연속 피격은 이보다 항상 더
  // 길게 벌어지므로 절대 걸러지지 않는다.
  const lastFlashAtRef = useRef<Partial<Record<"hit" | "success" | "finale-fail" | "parry", number>>>({});
  const triggerFlash = useCallback((kind: "hit" | "success" | "finale-fail" | "parry") => {
    const now = Date.now();
    // parry(발악 중간 패링)는 박자 자체가 0.4~0.8초라 700ms 디바운스를 그대로 쓰면
    // 다음 성공이 씹혀 보일 수 있어 훨씬 짧게 잡는다.
    const debounceMs = kind === "parry" ? 150 : 700;
    if (now - (lastFlashAtRef.current[kind] ?? 0) < debounceMs) return;
    lastFlashAtRef.current[kind] = now;
    flashId.current += 1;
    const myId = flashId.current;
    setFlash({ key: myId, kind });
    // flash는 여태 트리거된 뒤로 계속 true로 남아있어서, 그다음 렌더에서 같은 자리에
    // 같은 key로 다시 그려지는 걸 온전히 key 비교에만 맡기고 있었다 — 애니메이션이 다
    // 끝나는 시점에 명시적으로 null로 되돌려서 그 자리 자체가 사라지게 한다.
    // parry는 다음 박자(최소 400ms)를 가리지 않도록 짧게 끝낸다.
    const durationMs = kind === "success" ? 2000 : kind === "finale-fail" ? 1300 : kind === "parry" ? 260 : 350;
    const clearTimer = window.setTimeout(() => {
      setFlash((cur) => (cur && cur.key === myId ? null : cur));
    }, durationMs);
    pendingTimers.current.push(clearTimer);
  }, []);

  const showBossLine = useCallback((text: string, kind: "taunt" | "success" = "taunt") => {
    bossLineId.current += 1;
    const myId = bossLineId.current;
    setBossLine({ key: myId, text, kind });
    const timer = window.setTimeout(() => {
      setBossLine((cur) => (cur && cur.key === myId ? null : cur));
    }, BOSS_LINE_DISPLAY_MS);
    pendingTimers.current.push(timer);
  }, []);

  // 1페이즈에서 패턴1/패턴2가 새로 나올 때마다 50% 확률로 도발 대사를 띄운다.
  const maybeShowPatternTaunt = useCallback(() => {
    if (stageRef.current !== 1) return;
    if (Math.random() >= 0.5) return;
    showBossLine(BOSS_PATTERN_TAUNT_LINES[Math.floor(Math.random() * BOSS_PATTERN_TAUNT_LINES.length)]);
  }, [showBossLine]);

  // 발악/체크포인트(특수스킬 패턴) 성공 시 노란색 대사를 띄운다.
  const showSuccessLine = useCallback(() => {
    showBossLine(BOSS_SUCCESS_LINES[Math.floor(Math.random() * BOSS_SUCCESS_LINES.length)], "success");
  }, [showBossLine]);

  const endBattle = useCallback(
    (win: boolean, flashKind?: "hit" | "success" | "finale-fail") => {
      if (phaseRef.current === "result" || phaseRef.current === "blackout") return;
      clearPendingTimers();
      clearLaserTimers();
      wonRef.current = win;
      phaseRef.current = "result";
      setPhase("result");
      // 랭킹모드 — 2페이즈를 실제로 격파한 순간 한 번만 순위표에 기록한다. 토큰이 아직
      // 없거나(발급 실패) 경합으로 닉네임이 이미 쓰였거나 네트워크 오류가 나도, 전투
      // 결과 자체에는 영향 없다.
      if (win && stageRef.current === 2 && rankingNicknameRef.current && rankingTokenRef.current) {
        void submitBossClear(rankingNicknameRef.current, rankingTokenRef.current).catch(() => {});
      }
      const kind = flashKind ?? (win ? "success" : "hit");
      triggerFlash(kind);
      if (kind === "success") showSuccessLine();
      // 승패 텍스트 없이, 이펙트가 다 보인 뒤 화면이 암전된다. 1페이즈에서 이겼으면 암전 뒤
      // 2페이즈 등장으로, 2페이즈에서 이겼으면 그게 곧 진짜 승리라 입장맵으로, 실패/시간초과/
      // 죽음이면 그대로 입장맵으로 돌아간다.
      const effectMs = kind === "success" ? 2000 : kind === "finale-fail" ? 1300 : 350;
      const t = window.setTimeout(() => {
        phaseRef.current = "blackout";
        setPhase("blackout");
      }, effectMs + 150);
      pendingTimers.current.push(t);
    },
    [clearPendingTimers, clearLaserTimers, triggerFlash, showSuccessLine]
  );

  /** 레이저 — 패턴1/패턴2와 무관하게 독립적으로 판정되는 피격. p1Ref/p2Phase는 건드리지
   * 않아서, 다른 패턴이 진행 중이어도 그대로 유지된 채 맞은 그 가닥만 처리된다. */
  const registerLaserHit = useCallback(
    (key: number) => {
      laserBeamsRef.current = laserBeamsRef.current.filter((b) => b.key !== key);
      setLaserBeams(laserBeamsRef.current);
      triggerFlash("hit");
      // 레이저에 맞았을 때도 패턴1/패턴2는 똑같이 잠깐 숨 돌릴 틈을 준다(레이저 자체는
      // 계속 독립적으로 이어진다).
      nextPatternAllowedAtRef.current = Date.now() + (stageRef.current === 1 ? BOSS_BATTLE.hitRestMs : BOSS_PHASE2.hitRestMs);
      const prev = deathCountRef.current;
      const next = Math.max(0, prev - BOSS_LASER_DEATH_PENALTY);
      deathCountRef.current = next;
      setDeathCount(next);
      if (next < prev) showBossLine(BOSS_DEATH_TAUNT_LINES[Math.floor(Math.random() * BOSS_DEATH_TAUNT_LINES.length)]);
      if (next <= 0) endBattle(false);
    },
    [endBattle, triggerFlash, showBossLine]
  );

  /** 레이저 — 2페이즈 HP 25% 아래로 내려가면 시작되어, 다른 모든 패턴과 무관하게 무작위
   * 주기로 볼레이(한 번에 여러 가닥)가 계속 발사된다. pendingTimers가 아니라 laserTimers로
   * 따로 관리하므로 거꾸로 패턴이 진입해도 이 예약 자체는 끊기지 않는다(다만 실제로 뜨는
   * 건 combat 중일 때뿐). */
  const scheduleLaser = useCallback(() => {
    const delay = BOSS_LASER_INTERVAL_MIN_MS + Math.random() * (BOSS_LASER_INTERVAL_MAX_MS - BOSS_LASER_INTERVAL_MIN_MS);
    const timer = window.setTimeout(() => {
      if (phaseRef.current === "combat") {
        laserIdRef.current += 1;
        const volleyId = laserIdRef.current;
        laserVolleyRef.current = volleyId;
        const count = BOSS_LASER_COUNT_MIN + Math.floor(Math.random() * (BOSS_LASER_COUNT_MAX - BOSS_LASER_COUNT_MIN + 1));
        const warnBeams = Array.from({ length: count }, (_, i) => ({
          key: volleyId * 100 + i,
          cxFrac: 0.15 + Math.random() * 0.7,
          cyFrac: 0.15 + Math.random() * 0.7,
          angleDeg: Math.random() * 180,
          phase: "warn" as const,
        }));
        laserBeamsRef.current = warnBeams;
        setLaserBeams(warnBeams);
        const warnTimer = window.setTimeout(() => {
          if (laserVolleyRef.current !== volleyId) return;
          const activeBeams = laserBeamsRef.current.map((b) => ({ ...b, phase: "active" as const }));
          laserBeamsRef.current = activeBeams;
          setLaserBeams(activeBeams);
          const activeTimer = window.setTimeout(() => {
            if (laserVolleyRef.current !== volleyId) return;
            laserBeamsRef.current = [];
            setLaserBeams([]);
          }, BOSS_LASER_ACTIVE_MS);
          laserTimers.current.push(activeTimer);
        }, BOSS_LASER_WARN_MS);
        laserTimers.current.push(warnTimer);
      }
      // 전투가 완전히 끝난 게 아니라면 다른 어떤 패턴이 진행 중이어도 계속 예약한다.
      if (phaseRef.current !== "result" && phaseRef.current !== "blackout") scheduleLaser();
    }, delay);
    laserTimers.current.push(timer);
  }, []);

  /** 거꾸로 패턴 원 시퀀스가 끝난 뒤 — 하나라도 놓쳤으면 사망, 전부 맞혔으면 5초 기절(프리딜). */
  const finishInvertCircles = useCallback(() => {
    invertedRef.current = false;
    setInverted(false);
    circleTargetsRef.current = [];
    setCircleTargets([]);
    if (invertMissedRef.current) {
      endBattle(false);
      return;
    }
    showBossLine(BOSS_INVERT_STUN_LINE, "success");
    setStunned(true);
    // 검의 노란빛은 STUN_MS에 정확히 꺼지지만, 패턴은 그보다 BUFFER_MS만큼 더 늦게
    // 재개되어 기절이 끝났다는 걸 인지할 여유를 준다. nextPatternAllowedAtRef는 패턴이
    // 자연 종료될 때마다 짧게 덮어써지니, 이 여유시간은 invertBufferUntilRef로 따로 막는다.
    const patternsResumeAt = Date.now() + BOSS_INVERT_STUN_MS + BOSS_INVERT_STUN_BUFFER_MS;
    nextPatternAllowedAtRef.current = patternsResumeAt;
    invertBufferUntilRef.current = patternsResumeAt;
    const stunOffTimer = window.setTimeout(() => setStunned(false), BOSS_INVERT_STUN_MS);
    pendingTimers.current.push(stunOffTimer);
    lastTapAtRef.current = Date.now();
    phaseRef.current = "combat";
    setPhase("combat");
  }, [endBattle, showBossLine]);

  /** 거꾸로 패턴 — 원 하나의 결과(맞혔는지)를 처리한다. 새 원을 더 띄우는 건 spawnCircle
   * 자신의 반복 예약이 담당하므로, 여기선 마지막 원까지 다 정리됐는지만 확인한다. */
  const resolveCircle = useCallback(
    (id: number, hit: boolean) => {
      // 거꾸로 패턴이 아닌 동안 뒤늦게 발동하는 유령 타이머는 절대 처리하지 않는다.
      if (phaseRef.current !== "invertCircles") return;
      const target = circleTargetsRef.current.find((c) => c.key === id);
      if (!target) return;
      circleTargetsRef.current = circleTargetsRef.current.filter((c) => c.key !== id);
      setCircleTargets(circleTargetsRef.current);
      if (hit) {
        setHitEffects((prev) => [...prev, { key: target.key, xFrac: target.xFrac, yFrac: target.yFrac }]);
        const hitTimer = window.setTimeout(() => {
          setHitEffects((prev) => prev.filter((h) => h.key !== target.key));
        }, 380);
        pendingTimers.current.push(hitTimer);
      }
      if (!hit) {
        invertMissedRef.current = true;
        // 여러 원이 겹쳐서 뜨는 구조라 한꺼번에 여러 개를 놓칠 수 있다 — 화면 전체를
        // 덮는 피격 플래시나 대사를 매번 띄우면 우르르 겹쳐 보이므로, 놓친 그 자리에만
        // 조용히 표시를 남긴다(목숨은 HUD의 데스카운트 아이콘으로 바로 확인된다).
        setMissEffects((prev) => [...prev, { key: target.key, xFrac: target.xFrac, yFrac: target.yFrac }]);
        const missTimer = window.setTimeout(() => {
          setMissEffects((prev) => prev.filter((m) => m.key !== target.key));
        }, 380);
        pendingTimers.current.push(missTimer);
        const prev = deathCountRef.current;
        const next = Math.max(0, prev - BOSS_INVERT_CIRCLE_MISS_PENALTY);
        deathCountRef.current = next;
        setDeathCount(next);
        if (next <= 0) {
          endBattle(false);
          return;
        }
      }
      if (Date.now() >= invertSeqEndAtRef.current && circleTargetsRef.current.length === 0) finishInvertCircles();
    },
    [endBattle, finishInvertCircles]
  );

  /** 거꾸로 패턴 — 맵 위 랜덤한 위치에 새 빨간 원을 띄우고, 시퀀스가 끝나기 전까지
   * SPAWN_INTERVAL_MS마다 스스로를 다시 예약한다(앞의 원이 남아있어도 겹쳐서 새로 뜬다). */
  const spawnCircle = useCallback(() => {
    circleIdRef.current += 1;
    const myId = circleIdRef.current;
    // 화면 가장자리는 피해서 중앙 쪽 70% 범위 안에서만 뜬다.
    const target = { key: myId, xFrac: 0.15 + Math.random() * 0.7, yFrac: 0.15 + Math.random() * 0.7 };
    circleTargetsRef.current = [...circleTargetsRef.current, target];
    setCircleTargets(circleTargetsRef.current);
    const missTimer = window.setTimeout(() => {
      resolveCircle(myId, false);
    }, BOSS_INVERT_CIRCLE_WINDOW_MS);
    pendingTimers.current.push(missTimer);
    // 다음 원을 띄울지는 "지금(예약 시점)"이 아니라 실제로 타이머가 발동하는 시점에
    // 다시 확인해야 한다 — 예약 시점에만 확인하면, 시퀀스 종료 시각 직전에 마지막 원이
    // 뜨면서 예약해둔 다음 스폰이 종료 시각을 한참 지난 뒤(기절 상태에서) 뒤늦게
    // 발동해 버린다. 그 유령 원은 화면엔 안 보이지만 목숨은 실제로 깎아서, 기절 중
    // 아무것도 안 눌렀는데 갑자기 데스카운트가 줄거나 죽는 원인이었다.
    const spawnTimer = window.setTimeout(() => {
      if (phaseRef.current === "invertCircles" && Date.now() < invertSeqEndAtRef.current) spawnCircle();
    }, BOSS_INVERT_CIRCLE_SPAWN_INTERVAL_MS);
    pendingTimers.current.push(spawnTimer);
  }, [resolveCircle]);

  /** 2페이즈 HP 50% — "거꾸로 패턴" 진입. 암전+예고 대사 동안 모든 패턴을 멈췄다가,
   * 화면이 뒤집힌 채로 10초간 빨간 원 시퀀스가 시작된다. */
  const enterInvertTransition = useCallback(() => {
    clearPendingTimers();
    inPattern2Ref.current = false;
    p2JudgeableRef.current = false;
    p1Ref.current = IDLE_PATTERN1;
    setP1(IDLE_PATTERN1);
    setP2Phase("idle");
    setP2Judgeable(false);
    laserBeamsRef.current = [];
    setLaserBeams([]);
    phaseRef.current = "invertTransition";
    setPhase("invertTransition");
    showBossLine(BOSS_INVERT_LINE, "success");
    const timer = window.setTimeout(() => {
      invertedRef.current = true;
      setInverted(true);
      invertMissedRef.current = false;
      circleTargetsRef.current = [];
      setCircleTargets([]);
      invertSeqEndAtRef.current = Date.now() + BOSS_INVERT_CIRCLE_DURATION_MS;
      phaseRef.current = "invertCircles";
      setPhase("invertCircles");
      spawnCircle();
    }, BOSS_INVERT_TRANSITION_MS);
    pendingTimers.current.push(timer);
  }, [clearPendingTimers, showBossLine, spawnCircle]);

  /** 발악 링 판정 한 판을 (다시) 시작한다 — 스킬 버튼 잠금을 풀고, 시작 시각을 찍고,
   * 이 판을 놓쳤을 때의 자동 실패 타이머를 건다. 2페이즈는 이걸 여러 번 반복 호출해서
   * 리듬게임처럼 이어가는데, 매 박자 링 속도와 화면 위치를 무작위로 다시 뽑아서
   * 제각각 다르게 느껴지게 한다(1페이즈는 항상 고정된 사양·위치 그대로). */
  const startFinaleBeat = useCallback(() => {
    skillLockRef.current = false;
    finaleStartRef.current = Date.now();
    let durationMs: number;
    let windowMs: number;
    if (stageRef.current === 1) {
      durationMs = BOSS_BATTLE.finaleRingDurationMs;
      windowMs = BOSS_BATTLE.finaleWindowMs;
      setFinaleRingOffset(null);
    } else {
      durationMs =
        BOSS_PHASE2.finaleRingDurationMinMs + Math.random() * (BOSS_PHASE2.finaleRingDurationMaxMs - BOSS_PHASE2.finaleRingDurationMinMs);
      windowMs = durationMs * BOSS_PHASE2.finaleWindowRatio;
      setFinaleRingOffset({ dx: (Math.random() - 0.5) * 140, dy: (Math.random() - 0.5) * 180 });
    }
    finaleBeatDurationRef.current = durationMs;
    finaleBeatWindowRef.current = windowMs;
    const { end } = timingWindow(durationMs, windowMs);
    const timer = window.setTimeout(() => {
      if (phaseRef.current === "finale") endBattle(false, "finale-fail");
    }, end + 60);
    pendingTimers.current.push(timer);
  }, [endBattle]);

  // 2페이즈(진짜 격파, 리듬게임)만 HP가 0이 되는 순간 바로 시작하면 너무 갑작스러워서,
  // 예고 대사를 읽을 여유(BOSS_FINALE_TRANSITION_MS)를 준 뒤에 실제 발악이 시작되게
  // 한다 — 거꾸로 패턴 진입(enterInvertTransition)과 같은 암전+예고 구조. 1페이즈
  // (단발성 링 판정 한 번)는 굳이 암전으로 끊을 이유가 없어 원래대로 바로 시작한다.
  const enterFinale = useCallback(() => {
    clearPendingTimers();
    inPattern2Ref.current = false;
    p1Ref.current = IDLE_PATTERN1;
    setP1(IDLE_PATTERN1);
    setP2Phase("idle");
    setP2Judgeable(false);
    laserBeamsRef.current = [];
    setLaserBeams([]);
    finaleHitsRef.current = 0;
    setFinaleHits(0);
    if (stageRef.current === 1) {
      phaseRef.current = "finale";
      setPhase("finale");
      startFinaleBeat();
      return;
    }
    phaseRef.current = "finaleTransition";
    setPhase("finaleTransition");
    showBossLine(BOSS_FINALE_READY_LINE, "success");
    const timer = window.setTimeout(() => {
      phaseRef.current = "finale";
      setPhase("finale");
      startFinaleBeat();
    }, BOSS_FINALE_TRANSITION_MS);
    pendingTimers.current.push(timer);
  }, [clearPendingTimers, showBossLine, startFinaleBeat]);

  const registerPatternHit = useCallback(
    (penalty: number) => {
      // 한 번 맞으면 판정을 즉시 꺼서, 피격 이펙트가 나오는 동안 연타해도 중복으로
      // 맞지 않게 한다(패턴1 위험구역이든 패턴2 전체판정이든 동일하게 즉시 해제).
      p1Ref.current = IDLE_PATTERN1;
      setP1(IDLE_PATTERN1);
      inPattern2Ref.current = false;
      p2JudgeableRef.current = false;
      setP2Phase("idle");
      setP2Judgeable(false);
      // 방금 맞은 직후에는 일반 패턴 휴식시간(grantPatternRest)보다 훨씬 긴 여유를 줘서,
      // 맞자마자 다음 패턴이 바로 쏟아지는 느낌이 들지 않게 한다.
      const hitRestMs = stageRef.current === 1 ? BOSS_BATTLE.hitRestMs : BOSS_PHASE2.hitRestMs;
      nextPatternAllowedAtRef.current = Date.now() + hitRestMs;

      const prev = deathCountRef.current;
      const next = Math.max(0, prev - penalty);
      deathCountRef.current = next;
      setDeathCount(next);
      comboRef.current = 0;
      setCombo(0);
      triggerFlash("hit");
      if (next < prev) showBossLine(BOSS_DEATH_TAUNT_LINES[Math.floor(Math.random() * BOSS_DEATH_TAUNT_LINES.length)]);
      if (next <= 0) endBattle(false);
    },
    [endBattle, triggerFlash, showBossLine]
  );

  const triggerPattern2 = useCallback(() => {
    if (Date.now() < nextPatternAllowedAtRef.current) return; // 다른 패턴이 끝난 직후 휴식시간
    if (Date.now() < invertBufferUntilRef.current) return; // 거꾸로 패턴 기절 직후 여유시간
    maybeShowPatternTaunt();
    inPattern2Ref.current = true;
    setP2Phase("warn");
    // 겹침 방지 규칙 2 — 진행 중이던 패턴1을 즉시 idle로 되돌린다.
    p1Ref.current = IDLE_PATTERN1;
    setP1(IDLE_PATTERN1);

    const warnMs = stageRef.current === 1 ? BOSS_BATTLE.pattern2WarnMs : BOSS_PHASE2.pattern2WarnMs;
    const activeMs = stageRef.current === 1 ? BOSS_BATTLE.pattern2ActiveMs : BOSS_PHASE2.pattern2ActiveMs;
    const judgeMs = stageRef.current === 1 ? BOSS_BATTLE.pattern2JudgeMs : BOSS_PHASE2.pattern2JudgeMs;

    const warnTimer = window.setTimeout(() => {
      setP2Phase("active");
      p2JudgeableRef.current = true;
      setP2Judgeable(true);
      // 판정은 active 시작 시점의 짧은 순간만 — 나머지 잔상 구간은 이펙트만 보이고 안전하다.
      const judgeTimer = window.setTimeout(() => {
        p2JudgeableRef.current = false;
        setP2Judgeable(false);
      }, judgeMs);
      pendingTimers.current.push(judgeTimer);
      const activeTimer = window.setTimeout(() => {
        setP2Phase("idle");
        setP2Judgeable(false);
        inPattern2Ref.current = false;
        p2JudgeableRef.current = false;
        lastTapAtRef.current = Date.now(); // 재개 시 콤보 유예시간을 새로 준다
        grantPatternRest();
      }, activeMs);
      pendingTimers.current.push(activeTimer);
    }, warnMs);
    pendingTimers.current.push(warnTimer);
  }, [grantPatternRest, maybeShowPatternTaunt]);

  /** 2페이즈 전용 — 전체패턴을 HP 임계값이 아니라 무작위 주기로 반복 예약한다. */
  const scheduleStage2Pattern2 = useCallback(() => {
    const delay =
      BOSS_PHASE2.pattern2RandomMinMs + Math.random() * (BOSS_PHASE2.pattern2RandomMaxMs - BOSS_PHASE2.pattern2RandomMinMs);
    const timer = window.setTimeout(() => {
      if (phaseRef.current === "combat" && stageRef.current === 2 && !inPattern2Ref.current) {
        triggerPattern2();
      }
      if (
        phaseRef.current === "combat" ||
        phaseRef.current === "invertTransition" ||
        phaseRef.current === "invertCircles"
      ) {
        scheduleStage2Pattern2();
      }
    }, delay);
    pendingTimers.current.push(timer);
  }, [triggerPattern2]);

  const checkHpThresholds = useCallback(
    (nextHp: number) => {
      // 레이저 시작 여부는 다른 패턴의 겹침 방지 규칙과 완전히 무관하다 — 무엇이
      // 진행 중이든 HP 25% 아래로 내려가는 순간 바로 시작된다.
      if (stageRef.current === 2 && !laserModeRef.current && nextHp < BOSS_LASER_START_HP * maxHp2) {
        laserModeRef.current = true;
        showBossLine(BOSS_LASER_START_LINE);
        scheduleLaser();
      }
      if (inPattern2Ref.current) return; // 겹침 방지 규칙 1
      if (Date.now() < nextPatternAllowedAtRef.current) return; // 휴식시간 — 다음 탭에서 다시 확인
      if (Date.now() < invertBufferUntilRef.current) return; // 거꾸로 패턴 기절 직후 여유시간
      if (stageRef.current === 1) {
        for (const t of BOSS_BATTLE.pattern2Thresholds) {
          const absolute = t * maxHp1;
          if (nextHp < absolute && !crossedThresholds.current.has(t)) {
            crossedThresholds.current.add(t);
            triggerPattern2();
            break;
          }
        }
      } else {
        if (!invertCrossedRef.current && !invertedRef.current && nextHp < BOSS_INVERT_START_HP * maxHp2) {
          invertCrossedRef.current = true;
          enterInvertTransition();
          return;
        }
      }
    },
    [triggerPattern2, enterInvertTransition, scheduleLaser, showBossLine, maxHp1, maxHp2]
  );

  const triggerPattern1 = useCallback(() => {
    if (inPattern2Ref.current) return;
    // 패턴1의 반복 주기(intervalMs)가 예고+판정 전체 길이(warnMs+activeMs)보다 짧아서,
    // 이 가드가 없으면 이전 패턴이 채 안 끝났는데 다음 패턴이 겹쳐 덮어써 버린다 —
    // 경고 없이 갑자기 위험구역이 바뀌거나, 베기 이펙트가 끝까지 재생되지 못하고
    // 잘리는 원인이었다.
    if (p1Ref.current.phase !== "idle") return;
    if (Date.now() < nextPatternAllowedAtRef.current) return; // 다른 패턴이 끝난 직후 휴식시간
    if (Date.now() < invertBufferUntilRef.current) return; // 거꾸로 패턴 기절 직후 여유시간
    maybeShowPatternTaunt();
    const zoneCount = stageRef.current === 1 ? BOSS_BATTLE.zoneCount : BOSS_PHASE2.zoneCount;
    const dangerZoneCount = stageRef.current === 1 ? BOSS_BATTLE.dangerZoneCount : BOSS_PHASE2.dangerZoneCount;
    const warnMs = stageRef.current === 1 ? BOSS_BATTLE.pattern1WarnMs : BOSS_PHASE2.pattern1WarnMs;
    const activeMs = stageRef.current === 1 ? BOSS_BATTLE.pattern1ActiveMs : BOSS_PHASE2.pattern1ActiveMs;
    const judgeMs = stageRef.current === 1 ? BOSS_BATTLE.pattern1JudgeMs : BOSS_PHASE2.pattern1JudgeMs;
    const pattern1Penalty = stageRef.current === 1 ? BOSS_BATTLE.pattern1DeathPenalty : BOSS_PHASE2.pattern1DeathPenalty;
    const orientation = pickOrientation();
    const dangerZones = pickDangerZones(zoneCount, dangerZoneCount);
    // 피격존이 아닌 나머지 전부가 "반드시 눌러야 하는 존"이다.
    const mustHitZones = Array.from({ length: zoneCount }, (_, z) => z).filter((z) => !dangerZones.includes(z));
    slashId.current += 1;
    const myId = slashId.current;
    p1MustHitSatisfiedRef.current = false;
    setP1MustHitDone(false);
    const warnState: Pattern1State = { id: myId, phase: "warn", judgeable: false, orientation, dangerZones, mustHitZones };
    p1Ref.current = warnState;
    setP1(warnState);

    const warnTimer = window.setTimeout(() => {
      if (inPattern2Ref.current) {
        // 겹침 방지 규칙 3 — 전환하지 않고 조용히 idle로.
        p1Ref.current = IDLE_PATTERN1;
        setP1(IDLE_PATTERN1);
        return;
      }
      const activeState: Pattern1State = { ...warnState, phase: "active", judgeable: true };
      p1Ref.current = activeState;
      setP1(activeState);
      playBossPattern1AttackSound();
      // 판정은 active 시작 시점의 짧은 순간만 — 나머지 잔상 구간은 이펙트만 보이고 안전하다.
      const judgeTimer = window.setTimeout(() => {
        if (p1Ref.current.id !== myId) return;
        p1Ref.current = { ...p1Ref.current, judgeable: false };
        setP1(p1Ref.current);
      }, judgeMs);
      pendingTimers.current.push(judgeTimer);
      const activeTimer = window.setTimeout(() => {
        if (p1Ref.current.id !== myId) return;
        // 반드시 눌러야 하는 존을 active 동안 한 번도 못 눌렀다면 그대로 피격된다.
        if (!p1MustHitSatisfiedRef.current) {
          registerPatternHit(pattern1Penalty);
          return;
        }
        p1Ref.current = IDLE_PATTERN1;
        setP1(IDLE_PATTERN1);
        grantPatternRest();
      }, activeMs);
      pendingTimers.current.push(activeTimer);
    }, warnMs);
    pendingTimers.current.push(warnTimer);
  }, [grantPatternRest, maybeShowPatternTaunt, registerPatternHit]);

  const handleTap = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (phaseRef.current !== "combat") return;
      e.preventDefault();
      const rect = tapAreaRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const tapX = e.clientX - rect.left;
      const tapY = e.clientY - rect.top;
      const xFrac = Math.min(1, Math.max(0, tapX / rect.width));
      const yFrac = Math.min(1, Math.max(0, tapY / rect.height));

      // 레이저 — 패턴1/패턴2와 겹침 방지 없이 독립적으로 판정한다. 다른 위험판정보다
      // 먼저 확인해서, 여러 가닥 중 하나라도 닿았다면 그걸로 확정한다.
      for (const beam of laserBeamsRef.current) {
        if (beam.phase !== "active") continue;
        const cx = beam.cxFrac * rect.width;
        const cy = beam.cyFrac * rect.height;
        const rad = (beam.angleDeg * Math.PI) / 180;
        const dx = tapX - cx;
        const dy = tapY - cy;
        const perpDist = Math.abs(dx * Math.sin(rad) - dy * Math.cos(rad));
        if (perpDist <= BOSS_LASER_HIT_HALF_WIDTH_PX) {
          registerLaserHit(beam.key);
          return;
        }
      }

      const pattern2Penalty = stageRef.current === 1 ? BOSS_BATTLE.pattern2DeathPenalty : BOSS_PHASE2.pattern2DeathPenalty;
      const pattern1Penalty = stageRef.current === 1 ? BOSS_BATTLE.pattern1DeathPenalty : BOSS_PHASE2.pattern1DeathPenalty;

      // 렌더 시점의 p2Phase가 아니라 ref로 판단한다 — 판정이 켜진 직후 다시 그려지기 전에
      // 누른 터치가 놓치지 않도록.
      if (inPattern2Ref.current && p2JudgeableRef.current) {
        registerPatternHit(pattern2Penalty);
        return;
      }
      if (p1Ref.current.phase === "active") {
        const zoneCount = stageRef.current === 1 ? BOSS_BATTLE.zoneCount : BOSS_PHASE2.zoneCount;
        const zone = zoneOf(p1Ref.current.orientation, xFrac, yFrac, zoneCount);
        if (p1Ref.current.judgeable && p1Ref.current.dangerZones.includes(zone)) {
          registerPatternHit(pattern1Penalty);
          return;
        }
        // 반드시 눌러야 하는 존은 judgeable 여부와 상관없이 active인 동안 아무 때나
        // 한 번만 맞히면 된다.
        if (p1Ref.current.mustHitZones.includes(zone) && !p1MustHitSatisfiedRef.current) {
          p1MustHitSatisfiedRef.current = true;
          setP1MustHitDone(true);
        }
      }

      playHit("ku", 0); // 평소 검 터치음과 동일한 사운드로 타격감을 준다(단계 전용음은 안 씀).

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
    [registerPatternHit, checkHpThresholds, enterFinale, registerLaserHit]
  );

  /** 거꾸로 패턴 — 화면이 뒤집혀 있으므로 탭 좌표도 뒤집어서 원들의 논리 좌표와 비교한다.
   * 여러 원이 동시에 떠 있을 수 있으므로, 판정 범위 안에서 가장 가까운 원 하나만 맞힌다.
   * 범위 밖을 눌렀다면 그냥 무시(각 원 자신의 타이머가 놓침을 처리한다). */
  /** 거꾸로 패턴 — 빨간 원이 아닌 곳을 누르면 그 즉시 사망한다. 원이 하나도 없을 때
   * 누르는 것도 마찬가지(= 빨간 원 이외의 부분이므로). */
  const handleCircleTap = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (phaseRef.current !== "invertCircles") return;
      e.preventDefault();
      const rect = tapAreaRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const rawXFrac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const rawYFrac = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      const xFrac = 1 - rawXFrac;
      const yFrac = 1 - rawYFrac;
      let closest: { key: number; dist: number } | null = null;
      for (const target of circleTargetsRef.current) {
        const dx = (xFrac - target.xFrac) * rect.width;
        const dy = (yFrac - target.yFrac) * rect.height;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= CIRCLE_HIT_RADIUS_PX && (!closest || dist < closest.dist)) closest = { key: target.key, dist };
      }
      if (closest) resolveCircle(closest.key, true);
      else endBattle(false);
    },
    [resolveCircle, endBattle]
  );

  const handleFinaleSkill = useCallback(() => {
    if (phaseRef.current !== "finale" || skillLockRef.current) return;
    skillLockRef.current = true;
    const elapsed = Date.now() - finaleStartRef.current;
    // startFinaleBeat에서 이번 박자에 실제로 뽑아둔 값을 그대로 쓴다(2페이즈는 매
    // 박자 무작위라, 여기서 다시 계산하면 다른 값이 나와버린다).
    const { start, end } = timingWindow(finaleBeatDurationRef.current, finaleBeatWindowRef.current);
    const success = elapsed >= start && elapsed <= end;
    if (!success) {
      endBattle(false, "finale-fail");
      return;
    }
    if (stageRef.current === 1) {
      endBattle(true);
      return;
    }
    // 2페이즈 — 리듬게임: 검격에 맞춰 연속으로 finaleHitsRequired번 패링해야 진짜 격파다.
    // 하나라도 놓치면(위의 !success 분기) 그 즉시 실패한다.
    const nextHits = finaleHitsRef.current + 1;
    finaleHitsRef.current = nextHits;
    setFinaleHits(nextHits);
    if (nextHits >= BOSS_PHASE2.finaleHitsRequired) {
      endBattle(true);
      return;
    }
    // 1~4번째 성공은 전용 parry 이펙트로 번쩍여 보여준다 — 마지막 5번째만
    // endBattle(true)가 트리거하는(서휘령 격파) success 이펙트를 쓴다.
    triggerFlash("parry");
    clearPendingTimers();
    startFinaleBeat();
  }, [endBattle, triggerFlash, clearPendingTimers, startFinaleBeat]);

  // 2페이즈 격파 후일담 — 대사를 다 읽었거나 건너뛰면 엔딩 이미지 단계로 넘어간다.
  // 이 시점에 호출부(GameScreen 등)로 "후일담을 봤다"를 알려서 도감을 해금시킨다.
  const finishEpilogueDialogue = useCallback(() => {
    phaseRef.current = "epilogueImage";
    setPhase("epilogueImage");
    onVictoryEpilogueDoneRef.current?.();
  }, []);

  const advanceEpilogue = useCallback(() => {
    const next = epilogueLineRef.current + 1;
    if (next >= BOSS_EPILOGUE_LINES.length) {
      finishEpilogueDialogue();
      return;
    }
    epilogueLineRef.current = next;
    setEpilogueLine(next);
  }, [finishEpilogueDialogue]);

  // debugStartEpilogue로 바로 진입한 경우 — 정상 승리 흐름의 stopBossBgm 호출을
  // 건너뛰므로, 여기서 한 번만 대신 정지시킨다.
  useEffect(() => {
    if (debugStartEpilogue) stopBossBgm(false);
  }, [debugStartEpilogue]);

  // 랭킹모드로 입장한 경우 — 전투가 시작되는 이 시점에 1회용 토큰을 미리 받아 둔다.
  // 실패해도(네트워크 오류 등) 조용히 넘어간다 — 토큰이 없으면 격파해도 그냥 순위표
  // 등록만 안 될 뿐, 전투 자체에는 영향이 없다.
  useEffect(() => {
    if (!rankingNickname) return;
    let alive = true;
    startBossRankingSession(rankingNickname)
      .then((result) => {
        if (alive && result.ok && result.token) rankingTokenRef.current = result.token;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [rankingNickname]);

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
    setBossBgmPhase2();
    const timer = window.setTimeout(() => {
      stageRef.current = 2;
      setStage(2);
      const startHp = debugLowHp ? maxHp2 * 0.1 : maxHp2;
      hpRef.current = startHp;
      setHp(startHp);
      comboRef.current = 0;
      setCombo(0);
      // debugLowHp로 HP 10%부터 시작하면 거꾸로 패턴(50%)·레이저(25%) 임계값을 이미
      // 지난 것으로 쳐서, 발악(HP 0%)까지 방해 없이 곧장 갈 수 있게 한다.
      invertCrossedRef.current = debugLowHp;
      laserModeRef.current = debugLowHp;
      invertedRef.current = false;
      invertMissedRef.current = false;
      setInverted(false);
      lastTapAtRef.current = Date.now();
      battleStartRef.current = Date.now();
      setTimeLeftMs(timeLimit2);
      phaseRef.current = "combat";
      setPhase("combat");
      scheduleStage2Pattern2();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [phase, scheduleStage2Pattern2, debugLowHp, maxHp2, timeLimit2]);

  // 패턴1 반복 스케줄러 — 2페이즈는 더 빠른 주기로 돈다.
  useEffect(() => {
    if (phase !== "combat") return;
    const intervalMs = stage === 1 ? BOSS_BATTLE.pattern1IntervalMs : BOSS_PHASE2.pattern1IntervalMs;
    const interval = window.setInterval(() => triggerPattern1(), intervalMs);
    return () => window.clearInterval(interval);
  }, [phase, stage, triggerPattern1]);

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

  // 제한시간 3분 카운트다운 — 발악/거꾸로 패턴 중에도 계속 흐른다.
  useEffect(() => {
    if (
      phase !== "combat" &&
      phase !== "finaleTransition" &&
      phase !== "finale" &&
      phase !== "invertTransition" &&
      phase !== "invertCircles"
    )
      return;
    const interval = window.setInterval(() => {
      const timeLimitMs = stageRef.current === 1 ? BOSS_BATTLE.timeLimitMs : timeLimit2;
      const left = Math.max(0, timeLimitMs - (Date.now() - battleStartRef.current));
      setTimeLeftMs(left);
      if (left <= 0) endBattle(false);
    }, 500);
    return () => window.clearInterval(interval);
  }, [phase, endBattle, timeLimit2]);

  // 화면이 다 어두워지면: 1페이즈 발악 성공은 2페이즈 등장으로, 2페이즈 발악 성공(첫
  // blackout)은 후일담 대화로, 후일담을 다 본 뒤의 blackout은 그대로 입장맵으로,
  // 그 외(실패/시간초과/죽음)는 전부 입장맵으로 돌아간다.
  useEffect(() => {
    if (phase !== "blackout") return;
    if (wonRef.current && stageRef.current === 1) {
      const t = window.setTimeout(() => {
        phaseRef.current = "phase2Intro";
        setPhase("phase2Intro");
      }, 650);
      return () => window.clearTimeout(t);
    }
    if (wonRef.current && stageRef.current === 2 && !epilogueDoneRef.current) {
      const t = window.setTimeout(() => {
        stopBossBgm(false); // 후일담 동안은 조용히 — 메인 게임 브금도 되돌리지 않는다.
        epilogueLineRef.current = 0;
        setEpilogueLine(0);
        phaseRef.current = "epilogue";
        setPhase("epilogue");
      }, 650);
      return () => window.clearTimeout(t);
    }
    if (!wonRef.current) showBossLine(BOSS_DEFEAT_LINE);
    const exitMs = wonRef.current ? 650 : BOSS_DEFEAT_EXIT_MS;
    const t = window.setTimeout(() => onExitRef.current(), exitMs);
    return () => window.clearTimeout(t);
  }, [phase, showBossLine]);

  // 후일담 엔딩 이미지 — 4초 보여준 뒤 다시 암전하고(위 블록에서 이번엔 epilogueDoneRef가
  // true이므로 곧바로 입장맵으로) 나간다.
  useEffect(() => {
    if (phase !== "epilogueImage") return;
    const t = window.setTimeout(() => {
      epilogueDoneRef.current = true;
      phaseRef.current = "blackout";
      setPhase("blackout");
    }, BOSS_EPILOGUE_ENDING_IMAGE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // 언마운트 시 남아있는 타이머 정리.
  useEffect(() => () => clearPendingTimers(), [clearPendingTimers]);
  useEffect(() => () => clearLaserTimers(), [clearLaserTimers]);

  const showCombat = phase === "combat" || phase === "finale" || phase === "invertCircles";
  const maxHp = stage === 1 ? maxHp1 : maxHp2;
  const zoneCount = stage === 1 ? BOSS_BATTLE.zoneCount : BOSS_PHASE2.zoneCount;
  const epilogueCurrent = BOSS_EPILOGUE_LINES[Math.min(epilogueLine, BOSS_EPILOGUE_LINES.length - 1)];
  return (
    <section
      className={`bb-root boss-theme ${inverted ? "bb-inverted" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="서휘령과의 전투"
    >
      <div
        className="bb-bg"
        style={stage === 2 ? { backgroundImage: `linear-gradient(#00100f55, #000c), url('${BOSS_PHASE2_ASSETS.battleBgSrc}')` } : undefined}
      />
      <img
        className={`bb-boss-sword ${stage === 2 ? "bb-boss-sword--phase2" : ""} ${stunned ? "bb-boss-sword--stunned" : ""}`}
        src={stage === 2 ? BOSS_PHASE2_ASSETS.swordSrc : "/images/boss/boss-map-sword.webp"}
        alt=""
        aria-hidden
      />

      {phase === "intro" && (
        <div className="bb-intro bb-intro-splash">
          <img className="bb-intro-image" src="/images/boss-battle/phase1-intro-splash.png" alt="" />
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
              <span className="bb-hp-pct">{Math.max(0, Math.round((hp / maxHp) * 100))}%</span>
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

          {phase === "invertCircles" ? (
            <button
              ref={tapAreaRef}
              className="bb-tap-area bb-invert-circle-area"
              onPointerDown={handleCircleTap}
              aria-label="빨간 원 터치"
            >
              {circleTargets.map((c) => (
                <div
                  key={c.key}
                  className="bb-invert-circle"
                  style={{
                    left: `${c.xFrac * 100}%`,
                    top: `${c.yFrac * 100}%`,
                    animationDuration: `${BOSS_INVERT_CIRCLE_WINDOW_MS}ms`,
                  }}
                />
              ))}
              {hitEffects.map((h) => (
                <div
                  key={h.key}
                  className="bb-invert-hit"
                  style={{ left: `${h.xFrac * 100}%`, top: `${h.yFrac * 100}%` }}
                />
              ))}
              {missEffects.map((m) => (
                <div
                  key={m.key}
                  className="bb-invert-miss"
                  style={{ left: `${m.xFrac * 100}%`, top: `${m.yFrac * 100}%` }}
                />
              ))}
            </button>
          ) : (
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
                        p1.dangerZones.includes(z)
                          ? `bb-zone--danger bb-zone--${p1.phase}`
                          : p1.mustHitZones.includes(z)
                            ? `bb-zone--musthit bb-zone--${p1.phase}${p1MustHitDone ? " bb-zone--done" : ""}`
                            : ""
                      }`}
                      style={p1.orientation === "diagonal" ? { clipPath: diagonalZoneClipPath(z, zoneCount) } : undefined}
                    />
                  ))}
                </div>
              )}
              {p1.phase === "active" && stage === 2 && (
                <div className="bb-slash-scale-wrap">
                  <img
                    key={p1.id}
                    className={`bb-slash bb-slash--${p1.orientation}`}
                    src={SLASH_SRC_PHASE2[p1.orientation]}
                    style={{ animationDuration: `${BOSS_PHASE2.pattern1ActiveMs}ms` }}
                    alt=""
                  />
                </div>
              )}
              {p1.phase === "active" && stage === 1 && (
                <img
                  key={p1.id}
                  className={`bb-slash bb-slash--${p1.orientation}`}
                  src={SLASH_SRC[p1.orientation]}
                  style={{ animationDuration: `${BOSS_BATTLE.pattern1ActiveMs}ms` }}
                  alt=""
                />
              )}
              {p2Phase !== "idle" && (
                <div
                  className={`bb-full-warning bb-full-warning--${p2Phase}${p2Judgeable ? " bb-full-warning--judge" : ""}`}
                  style={
                    p2Phase === "warn"
                      ? { animationDuration: `${stage === 1 ? BOSS_BATTLE.pattern2WarnMs : BOSS_PHASE2.pattern2WarnMs}ms` }
                      : undefined
                  }
                />
              )}
              {p2Phase === "active" && <img className="bb-full-slash" src={FULL_SLASH_SRC} alt="" />}
              {laserBeams.map((beam) => (
                <div
                  key={beam.key}
                  className={`bb-laser bb-laser--${beam.phase}`}
                  style={{
                    left: `${beam.cxFrac * 100}%`,
                    top: `${beam.cyFrac * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${beam.angleDeg}deg)`,
                  }}
                />
              ))}
            </button>
          )}
        </>
      )}

      {phase === "finale" && (
        <div className="bb-finale-layer">
          {stage === 2 && (
            <p className="bb-finale-hits">
              {finaleHits} / {BOSS_PHASE2.finaleHitsRequired}
            </p>
          )}
          <div
            className="bb-finale-rings"
            style={
              finaleRingOffset
                ? { transform: `translate(${finaleRingOffset.dx}px, ${finaleRingOffset.dy}px)` }
                : undefined
            }
          >
            <div className="bb-finale-ring-target" />
            {/* 2페이즈는 이 판정을 여러 번 반복하므로, key를 박자 번호로 줘서 매 박자마다
                줄어드는 애니메이션이 처음부터 다시 재생되게 한다. */}
            <div
              key={finaleHits}
              className="bb-finale-ring-shrink"
              style={{ animationDuration: `${finaleBeatDurationRef.current}ms` }}
            />
          </div>
          <button className="bb-skill-btn" onClick={handleFinaleSkill} aria-label="특수 스킬 사용">
            <img className="bb-skill-icon" src="/images/boss-battle/skill-bind.png" alt="" />
          </button>
        </div>
      )}

      {phase === "epilogue" && (
        <div className="bb-epilogue">
          <button className="tutorial-skip boss-skip" onClick={finishEpilogueDialogue}>건너뛰기</button>
          <button className="boss-dialogue-advance" onClick={advanceEpilogue} aria-label="다음 대사">
            {epilogueCurrent.speaker !== "narrator" && (
              <img
                className="boss-portrait"
                src={BOSS_EPILOGUE_PORTRAITS[epilogueCurrent.speaker as "hwiryeong" | "yeohan"]}
                alt={epilogueCurrent.name}
              />
            )}
            <div className="tutorial-dialogue" aria-live="polite">
              <p className="tutorial-name">{epilogueCurrent.name}</p>
              <p className="tutorial-line">{epilogueCurrent.text}</p>
              <p className="tutorial-next-hint">탭하여 계속</p>
            </div>
          </button>
        </div>
      )}

      {phase === "epilogueImage" && (
        <div className="bb-epilogue">
          <div className="boss-reveal-image-wrap">
            <img className="boss-reveal-image" src={BOSS_EPILOGUE_ENDING_IMAGE_SRC} alt="" />
          </div>
        </div>
      )}

      {flash && flash.kind === "finale-fail" && (
        <img key={flash.key} className="bb-flash bb-flash--finale-fail" src="/images/boss-battle/finale-fail-sweep.png" alt="" />
      )}
      {flash && flash.kind === "parry" && (
        <Fragment key={flash.key}>
          <div className="bb-flash bb-flash--parry-white" />
          <img className="bb-flash bb-flash--parry" src="/images/boss-battle/skill-parry.png" alt="" />
        </Fragment>
      )}
      {flash && flash.kind === "success" && (
        <Fragment key={flash.key}>
          <div className="bb-flash bb-flash--success-white" />
          <img className="bb-flash bb-flash--success" src="/images/boss-battle/skill-success.png" alt="" />
        </Fragment>
      )}
      {flash && flash.kind === "hit" && <div key={flash.key} className="bb-flash bb-flash--hit" />}

      {bossLine && (
        <p key={bossLine.key} className={`bb-boss-line ${bossLine.kind === "success" ? "bb-boss-line--success" : ""}`}>
          {bossLine.text}
        </p>
      )}

      {phase === "blackout" && <div className="bb-blackout" />}
      {phase === "invertTransition" && <div className="bb-blackout" />}
      {phase === "finaleTransition" && <div className="bb-blackout" />}
    </section>
  );
}
