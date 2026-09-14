/**
 * 서휘령 전투 미니게임의 순수 수치 로직.
 *
 * 이 전투는 공동 칼과 달리 서버 동기화가 없는 완전한 로컬 미니게임이다 — 승패도,
 * 진행 상황도 저장되지 않는다. 그래서 밸런스도 여기 상수 하나로만 관리된다
 * (schema.sql처럼 서버와 값을 맞출 필요가 없다).
 */

/** 입장 시 3초간 암전과 함께 뜨는 대사. */
export const BOSS_BATTLE_INTRO_LINE = "과연, 너는 얼마나 버틸 수 있을까?";

/** 발악 패링 성공 후 암전 뒤에 2페이즈 등장과 함께 뜨는 대사. */
export const PHASE2_INTRO_LINE = "여기서.. 여기서 물러날 순 없다!";

/** 1페이즈에서 패턴(패턴1/패턴2)이 새로 나올 때, 50% 확률로 이 중 하나가 랜덤으로 뜬다. */
export const BOSS_PATTERN_TAUNT_LINES = [
  "감히, 이곳이 어디라고!",
  "너는 절대 나를 이길 수 없을 것이다.",
  "실력을 보여봐라!",
  "겨우 이정도로 나에게 덤비다니!",
] as const;

/** 1·2페이즈 공통 — 목숨(데스카운트)이 줄어들 때마다 이 중 하나가 랜덤으로 뜬다. */
export const BOSS_DEATH_TAUNT_LINES = [
  "한심하구나.",
  "자비는 없다.",
  "포기하는게 어때?",
  "겨우 이정도였나..",
] as const;

/** 보스 대사 한 줄이 화면에 떠 있다가 사라지는 시간. */
export const BOSS_LINE_DISPLAY_MS = 1800;

/** 발악/체크포인트(특수스킬 패턴) 성공 시 노란색으로 뜨는 대사 — 4가지 중 하나가 랜덤 등장. */
export const BOSS_SUCCESS_LINES = [
  "제발, 정신 차려 서휘령!",
  "이 힘이, 부디 도움이 되길..",
  "서휘령, 이제 그만해!",
  "당신을.. 도와드릴게요!",
] as const;

/** 패배해서 퇴장당할 때, 암전과 함께 뜨는 대사. */
export const BOSS_DEFEAT_LINE = "한심한 녀석. 다시는 이곳에 발을 들이지 마라.";

/** 패배 후 대사를 읽을 시간을 주고 나서 입장맵으로 돌아가기까지의 시간. */
export const BOSS_DEFEAT_EXIT_MS = 2600;

/** 2페이즈 HP 50%에서 뜨는 "거꾸로 패턴" 예고 대사(노란빛). */
export const BOSS_INVERT_LINE = "주의하세요. 서휘령이 모든걸 뒤바꿀거에요. 현실도, 당신의 감각마저도!";

/** 거꾸로 패턴이 시작되는/끝나는 HP 비율(2페이즈 전용). */
export const BOSS_INVERT_START_HP = 0.5;
export const BOSS_INVERT_END_HP = 0.4;

/** 암전 상태로 대사를 읽고, 그동안 패턴이 멈춰 있는 시간. */
export const BOSS_INVERT_TRANSITION_MS = 2600;

/** 1페이즈 — 전부 임시값, 실제 플레이테스트 후 조정 권장. */
export const BOSS_BATTLE = {
  maxHp: 1300,
  baseDamage: 4,
  maxCombo: 50,
  comboDecayMs: 1500,
  maxDamageMultiplier: 3,
  maxDeathCount: 5,
  zoneCount: 3,
  dangerZoneCount: 2,
  /** 패턴 하나하나의 시전 주기 자체는 살짝 느긋해졌지만(휘몰아치는 느낌은
   * intervalMs/patternRestMs 쪽에서 만든다), 새 패턴이 튀어나오는 간격은 훨씬 짧아서
   * 이전 패턴의 잔상이 채 사라지기도 전에 다음 패턴이 겹쳐 들어온다. */
  pattern1IntervalMs: 1100,
  pattern1WarnMs: 850,
  pattern1ActiveMs: 1100,
  /** 판정(위험구역이 실제로 맞는지 체크하는)이 열려있는 시간 — activeMs 전체가 아니라
   * 이 짧은 순간에만 맞는다. 나머지는 이펙트만 보여주는 잔상 구간이라 눌러도 안전하다. */
  pattern1JudgeMs: 220,
  pattern1DeathPenalty: 1,
  pattern2Thresholds: [0.75, 0.5, 0.25],
  pattern2WarnMs: 2500,
  pattern2ActiveMs: 680,
  pattern2JudgeMs: 220,
  pattern2DeathPenalty: 3,
  finaleRingDurationMs: 2200,
  finaleWindowMs: 1400,
  timeLimitMs: 3 * 60 * 1000,
  /** 패턴이 끝난 직후 다른 패턴이 곧바로 겹쳐 나오지 않도록 주는 최소 휴식시간 —
   * 휘몰아치는 느낌을 위해 짧게 줄였다(완전히 안 겹치게 하려던 목적이 아니라, 서로
   * 다른 두 패턴이 정확히 같은 프레임에 시작하는 것만 막는 정도). */
  patternRestMs: 300,
} as const;

/**
 * 2페이즈 — 1페이즈를 격파(발악 패링 성공)한 뒤 이어지는 진짜 서휘령의 모습.
 *   - 체력이 1페이즈보다 훨씬 많다(밸런스 조정으로 50% 증가).
 *   - 3분할이 아니라 5분할, 그 중 4곳이 위험구역(안전 구역 1곳뿐)이라 훨씬 빡빡하다.
 *   - 패턴1(가로/세로/대각선 베기)은 1페이즈보다 훨씬 빠르고, 패턴2(전체판정)도
 *     시전 자체는 빠르지만 등장 빈도는 낮췄다(너무 자주 뜨면 패턴1이 멈추는 그
 *     동안이 오히려 프리딜 타임이 되어버리기 때문).
 *   - 1페이즈에서 HP 75/50/25%마다 뜨던 전체공격(패턴2)은 이제 그 타이밍과 무관하게
 *     무작위 주기로 튀어나온다(단, 패턴1과 절대 안 겹치게 겹침 방지 로직을 그대로 적용).
 *   - HP 75%때만 발악(패링)이 뜬다 — 1페이즈의 "죽으면 뜨는 최후의 한 번"과 달리,
 *     성공/실패해도 전투가 끝나지 않고(실패하면 목숨만 깎이고) 계속 이어지다가,
 *     HP가 0이 되는 순간 그게 곧 최종 승리다. 발악 자체는 1페이즈와 완전히 동일한
 *     사양(링 2.2초, 판정창 1.4초, 한 번만 좁혀짐)이다.
 *   - HP 50%에 도달하면 "거꾸로 패턴" 구간에 들어간다 — 암전과 예고 대사 뒤 화면이
 *     거꾸로 뒤집히고, 지금 활성화된 빨간 위험구역을 정확히 맞혀야만 데미지가 들어가며
 *     그 외(패턴이 안 나와 있을 때 포함) 모든 탭은 목숨이 깎인다. 판정 자체가 워낙
 *     가혹해서, 이 구간만큼은 패턴1 속도를 평소보다 늦춰 최소한의 여유를 준다.
 *     HP 40%에서 원래대로 돌아온다.
 */
export const BOSS_PHASE2 = {
  maxHp: 1920,
  baseDamage: 4,
  maxCombo: 50,
  comboDecayMs: 1500,
  maxDamageMultiplier: 3,
  zoneCount: 5,
  dangerZoneCount: 4,
  // 기본패턴(가로/세로/대각선 베기) 속도 20% 증가.
  pattern1IntervalMs: 710,
  pattern1WarnMs: 540,
  pattern1ActiveMs: 710,
  pattern1JudgeMs: 220,
  pattern1DeathPenalty: 1,
  // 거꾸로 패턴 중에는 "빨간 구역을 정확히 맞혀야만 산다"는 판정 자체가 이미 훨씬
  // 어렵기 때문에, 패턴1 속도는 평소보다 느긋하게 늦춰서 최소한의 여유를 준다.
  invertPattern1IntervalMs: 1700,
  invertPattern1WarnMs: 950,
  invertPattern1ActiveMs: 1200,
  // 전체패턴 warn 구간 동안은 패턴1이 멈춰서 사실상 프리딜 타임이 된다 — 너무 자주
  // 뜨면 오히려 쉬워지므로 등장 확률(빈도)을 낮게 잡는다.
  pattern2RandomMinMs: 7000,
  pattern2RandomMaxMs: 12000,
  pattern2WarnMs: 1850,
  pattern2ActiveMs: 580,
  pattern2JudgeMs: 220,
  pattern2DeathPenalty: 3,
  // 25%·50% 때는 더 이상 뜨지 않는다(50%는 "거꾸로 패턴" 구간과 겹쳐서 뺐다) — 75%때만.
  checkpointThresholds: [0.75],
  // 발악(패링) 판정이 너무 촉박하다는 반복된 피드백으로, 1페이즈 발악과 완전히 같은
  // 사양(링 2.2초, 판정창 1.4초, 한 번만 좁혀짐 — 2배속 반복 없음)으로 통일했다.
  checkpointRingDurationMs: 2200,
  checkpointWindowMs: 1400,
  checkpointFailPenalty: 2,
  timeLimitMs: 3 * 60 * 1000,
  patternRestMs: 250,
} as const;

export type Orientation = "vertical" | "horizontal" | "diagonal";

/** 탭 좌표(각 축 0~1로 정규화)를 zoneCount분할 구역 중 하나(0~zoneCount-1)로 매핑한다. */
export function zoneOf(orientation: Orientation, xFrac: number, yFrac: number, zoneCount: number): number {
  if (orientation === "vertical") return Math.min(zoneCount - 1, Math.floor(xFrac * zoneCount));
  if (orientation === "horizontal") return Math.min(zoneCount - 1, Math.floor(yFrac * zoneCount));
  const d = xFrac + yFrac; // 대각선 기준값, 0~2
  return Math.min(zoneCount - 1, Math.floor((d * zoneCount) / 2));
}

/**
 * 대각선 분할에서 zoneIndex번째 구역의 clip-path 폴리곤(단위 정사각형 기준, %).
 * 정사각형을 x+y=lo, x+y=hi 두 직선으로 자른 띠 모양을 Sutherland–Hodgman 클리핑으로 구한다.
 * zoneCount가 3이든 5든 같은 방식으로 계산되므로 구역 수가 바뀌어도 그대로 쓸 수 있다.
 */
export function diagonalZoneClipPath(zoneIndex: number, zoneCount: number): string {
  const lo = (2 * zoneIndex) / zoneCount;
  const hi = (2 * (zoneIndex + 1)) / zoneCount;
  type Pt = [number, number];
  let poly: Pt[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const clipHalfPlane = (keep: (p: Pt) => boolean, bound: number) => {
    const out: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i];
      const prev = poly[(i + poly.length - 1) % poly.length];
      const curIn = keep(cur);
      const prevIn = keep(prev);
      const intersect = (): Pt => {
        const da = prev[0] + prev[1];
        const db = cur[0] + cur[1];
        const t = (bound - da) / (db - da);
        return [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
      };
      if (curIn) {
        if (!prevIn) out.push(intersect());
        out.push(cur);
      } else if (prevIn) {
        out.push(intersect());
      }
    }
    poly = out;
  };
  clipHalfPlane(([x, y]) => x + y >= lo - 1e-9, lo);
  clipHalfPlane(([x, y]) => x + y <= hi + 1e-9, hi);
  if (poly.length === 0) return "polygon(0% 0%, 0% 0%, 0% 0%)";
  return `polygon(${poly.map(([x, y]) => `${(x * 100).toFixed(3)}% ${(y * 100).toFixed(3)}%`).join(", ")})`;
}

/** 콤보(0~maxCombo)에 비례한 데미지 배수 — 1배 ~ maxDamageMultiplier배. 1·2페이즈 공용. */
export function damageMultiplier(combo: number): number {
  return 1 + (combo / BOSS_BATTLE.maxCombo) * (BOSS_BATTLE.maxDamageMultiplier - 1);
}

/** zoneCount개 구역 중 dangerCount개를 무작위로 고른다. */
export function pickDangerZones(zoneCount: number, dangerCount: number): number[] {
  const zones = Array.from({ length: zoneCount }, (_, i) => i);
  const chosen: number[] = [];
  for (let i = 0; i < dangerCount && zones.length > 0; i++) {
    const idx = Math.floor(Math.random() * zones.length);
    chosen.push(zones.splice(idx, 1)[0]);
  }
  return chosen;
}

export function pickOrientation(): Orientation {
  const list: Orientation[] = ["vertical", "horizontal", "diagonal"];
  return list[Math.floor(Math.random() * list.length)];
}

/** mm:ss 형식으로 남은 시간을 표시한다. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** durationMs 근방 ±windowMs/2의 유효 시간창(발악/발악형 체크포인트 공용). */
export function timingWindow(durationMs: number, windowMs: number): { start: number; end: number } {
  const half = windowMs / 2;
  return { start: durationMs - half, end: durationMs + half };
}

/** 1페이즈 발악의 유효 시간창 — timingWindow(finaleRingDurationMs, finaleWindowMs)의 편의 함수. */
export function finaleWindow(): { start: number; end: number } {
  return timingWindow(BOSS_BATTLE.finaleRingDurationMs, BOSS_BATTLE.finaleWindowMs);
}
