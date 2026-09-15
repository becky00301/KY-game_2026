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

/** 거꾸로 패턴이 시작되는 HP 비율(2페이즈 전용, 1회성 — HP가 이 아래로 떨어지는 순간 한 번만). */
export const BOSS_INVERT_START_HP = 0.5;

/** 암전 상태로 예고 대사를 읽고, 그동안 모든 패턴이 멈춰 있는 시간. */
export const BOSS_INVERT_TRANSITION_MS = 2600;

/** 거꾸로 패턴 본체 — 화면이 뒤집힌 채로 맵 곳곳에 빨간 원이 반복해서 나타난다.
 *   - INVERT_CIRCLE_SPAWN_INTERVAL_MS마다 새 원이 새 위치에 뜬다 — 앞의 원이 아직
 *     안 사라졌어도 그대로 겹쳐서 새로 뜬다(여러 개가 동시에 떠 있을 수 있다).
 *   - 원이 뜨고 나서 INVERT_CIRCLE_WINDOW_MS 안에 터치하지 못하면 그 원은 놓친 것으로
 *     처리된다(목숨 감소). INVERT_CIRCLE_DURATION_MS 동안 이 과정이 반복된다.
 *   - 빨간 원이 아닌 곳을 터치하면(원이 하나도 없을 때 터치하는 것 포함) 그 즉시 사망한다.
 *   - 이 구간에서 하나라도 놓쳤다면, 다 끝난 뒤 그대로 죽는다(즉시 죽는 게 아니라
 *     원 하나하나는 목숨만 깎고, 뜬 원이 전부 정리된 시점에 최종적으로 사망 처리된다).
 *   - 하나도 안 놓치고 전부 맞혔다면, 서휘령이 INVERT_STUN_MS 동안 기절한다 —
 *     이 사이엔 어떤 패턴도 안 뜨는 순수 프리딜 타임이다.
 */
export const BOSS_INVERT_CIRCLE_DURATION_MS = 10000;
export const BOSS_INVERT_CIRCLE_SPAWN_INTERVAL_MS = 900;
export const BOSS_INVERT_CIRCLE_WINDOW_MS = 1700;
export const BOSS_INVERT_CIRCLE_MISS_PENALTY = 1;
/** 기절 지속시간 — 이 동안 검이 노란빛으로 빛나 한눈에 기절 상태임을 알 수 있다. */
export const BOSS_INVERT_STUN_MS = 5000;
/** 기절이 풀린 뒤에도 이만큼은 패턴이 나오지 않는다 — 기절 종료를 인지할 여유를 준다. */
export const BOSS_INVERT_STUN_BUFFER_MS = 500;
export const BOSS_INVERT_STUN_LINE = "서휘령의 공격을 막아냈어요! 지금이 기회입니다!";

/** 2페이즈 HP 25% 이하 — 맵을 가로지르는 얇은 레이저 여러 가닥이 한 번에(볼레이) 무작위
 *  위치·방향으로 자주 발사된다. 패턴1/패턴2와 겹침 방지 없이 독립적으로 판정되며(그래서
 *  다른 모든 패턴과 동시에 뜰 수 있다), HP가 다시 올라가도 한 번 시작되면 전투가 끝날
 *  때까지 계속된다. 레이저(판정 구간)를 터치하면 데스카운트가 줄어든다. */
export const BOSS_LASER_START_HP = 0.25;
/** HP 25% 아래로 내려가는 순간 뜨는 서휘령의 대사. */
export const BOSS_LASER_START_LINE = "온 힘을 다해, 너를 처단하리라!!";
/** 한 볼레이에 동시에 뜨는 레이저 가닥 수 (최소~최대 중 무작위). */
export const BOSS_LASER_COUNT_MIN = 5;
export const BOSS_LASER_COUNT_MAX = 6;
// warnMs(전조)보다는 항상 길게 잡아서 볼레이가 최소한 한 번은 실제로 active(위험)
// 상태까지는 도달하게 한다 — 그래도 다음 볼레이가 곧바로 겹쳐 들어와 끊임없이
// 몰아치는 느낌을 준다.
export const BOSS_LASER_INTERVAL_MIN_MS = 650;
export const BOSS_LASER_INTERVAL_MAX_MS = 1000;
export const BOSS_LASER_WARN_MS = 500;
export const BOSS_LASER_ACTIVE_MS = 500;
export const BOSS_LASER_DEATH_PENALTY = 1;
/** 판정 폭의 절반(px) — 실제 표시는 훨씬 얇지만 터치 여유를 약간 준다. */
export const BOSS_LASER_HIT_HALF_WIDTH_PX = 16;

/** 1페이즈 — 전부 임시값, 실제 플레이테스트 후 조정 권장. */
export const BOSS_BATTLE = {
  maxHp: 1300,
  baseDamage: 4,
  maxCombo: 50,
  comboDecayMs: 1500,
  maxDamageMultiplier: 3,
  maxDeathCount: 5,
  zoneCount: 3,
  // 3분할 중 2곳은 피격존, 나머지 1곳은 "반드시 눌러야 하는 존"(노란빛)이다 — active 동안
  // 그 존을 못 누르면 맞는다.
  dangerZoneCount: 2,
  /** 패턴 하나하나의 시전 주기 자체는 살짝 느긋해졌지만(휘몰아치는 느낌은
   * intervalMs/patternRestMs 쪽에서 만든다), 새 패턴이 튀어나오는 간격은 훨씬 짧아서
   * 이전 패턴의 잔상이 채 사라지기도 전에 다음 패턴이 겹쳐 들어온다. */
  pattern1IntervalMs: 1100,
  // 반드시 눌러야 하는 존이 생긴 만큼, 전조(warn) 시간을 살짝 다시 늘렸다.
  pattern1WarnMs: 500,
  pattern1ActiveMs: 1100,
  /** 판정(위험구역이 실제로 맞는지 체크하는)이 열려있는 시간 — activeMs 전체가 아니라
   * 이 짧은 순간에만 맞는다. 나머지는 이펙트만 보여주는 잔상 구간이라 눌러도 안전하다. */
  pattern1JudgeMs: 220,
  pattern1DeathPenalty: 1,
  pattern2Thresholds: [0.75, 0.5, 0.25],
  pattern2WarnMs: 1000,
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
  /** 맞았을 때만 주는 별도의 더 긴 휴식시간 — 방금 맞아서 정신 없는데 바로 다음 패턴이
   * 쏟아지면 너무 가혹해서, 피격 직후에는 일반 휴식시간보다 훨씬 길게 숨 돌릴 틈을 준다. */
  hitRestMs: 700,
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
 *   - 중간 체크포인트(발악) 없이, HP가 0이 되는 순간에만 1페이즈와 완전히 동일한 사양
 *     (링 2.2초, 판정창 1.4초, 한 번만 좁혀짐)의 발악이 뜬다 — 그게 곧 최종 승리다.
 *   - HP 50%에 도달하면(1회성) "거꾸로 패턴"에 들어간다 — 암전과 예고 대사 뒤 화면이
 *     거꾸로 뒤집히고, 모든 일반 패턴이 멈춘 채로 10초간 맵 곳곳에 빨간 원이 반복해서
 *     나타난다. 하나라도 놓치면 10초 뒤 그대로 사망, 전부 맞히면 서휘령이 5초간
 *     기절해서 순수 프리딜 타임이 된다. 이후 일반 전투로 돌아온다.
 *   - HP 25% 아래로 내려가면 맵을 가로지르는 레이저 볼레이가 다른 모든 패턴과 무관하게
 *     계속 겹쳐서 발사된다.
 */
export const BOSS_PHASE2 = {
  maxHp: 2304,
  baseDamage: 4,
  maxCombo: 50,
  comboDecayMs: 1500,
  maxDamageMultiplier: 3,
  zoneCount: 5,
  // 5분할 중 3곳은 피격존, 나머지 2곳은 "반드시 눌러야 하는 존"(노란빛)이다 — active 동안
  // 그 중 아무 곳이나 한 번은 못 누르면 맞는다.
  dangerZoneCount: 3,
  // 기본패턴(가로/세로/대각선 베기) 속도는 추가로 빨라졌었지만, 반드시 눌러야 하는 존이
  // 생긴 만큼 전조(warn) 시간은 살짝 다시 늘렸다.
  pattern1IntervalMs: 600,
  pattern1WarnMs: 340,
  pattern1ActiveMs: 620,
  pattern1JudgeMs: 220,
  pattern1DeathPenalty: 1,
  // 전체패턴 warn 구간 동안은 패턴1이 멈춰서 사실상 프리딜 타임이 된다 — 너무 자주
  // 뜨면 오히려 쉬워지므로 등장 확률(빈도)을 낮게 잡는다.
  pattern2RandomMinMs: 7000,
  pattern2RandomMaxMs: 12000,
  pattern2WarnMs: 750,
  pattern2ActiveMs: 580,
  pattern2JudgeMs: 220,
  pattern2DeathPenalty: 3,
  // 중간 체크포인트(75%) 없이, HP 0%때 발악만 뜬다. 2페이즈는 리듬게임처럼 이 링
  // 판정을 연속으로 finaleHitsRequired번 성공해야 진짜 격파된다 — 하나라도 놓치면
  // 그 즉시 실패. 매 박자마다 링이 줄어드는 속도(duration)를 무작위로 다시 뽑아서
  // 제각각 다르게 느껴지게 하고, 판정창은 그 속도에 비례한 비율로 유지해 난이도를
  // 맞춘다. 위치도 매 박자 무작위로 옮겨서(finaleRingOffset) 화면 이곳저곳에 뜬다.
  finaleRingDurationMinMs: 400,
  finaleRingDurationMaxMs: 800,
  finaleWindowRatio: 0.64,
  finaleHitsRequired: 5,
  timeLimitMs: 3 * 60 * 1000,
  patternRestMs: 180,
  /** 맞았을 때만 주는 별도의 더 긴 휴식시간 — 방금 맞아서 정신 없는데 바로 다음 패턴이
   * 쏟아지면 너무 가혹해서, 피격 직후에는 일반 휴식시간보다 훨씬 길게 숨 돌릴 틈을 준다. */
  hitRestMs: 650,
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
