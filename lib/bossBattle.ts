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
  pattern1IntervalMs: 1600,
  pattern1WarnMs: 500,
  pattern1ActiveMs: 650,
  pattern1DeathPenalty: 1,
  pattern2Thresholds: [0.75, 0.5, 0.25],
  pattern2WarnMs: 1500,
  pattern2ActiveMs: 400,
  pattern2DeathPenalty: 3,
  finaleRingDurationMs: 2200,
  finaleWindowMs: 500,
  timeLimitMs: 3 * 60 * 1000,
} as const;

/**
 * 2페이즈 — 1페이즈를 격파(발악 패링 성공)한 뒤 이어지는 진짜 서휘령의 모습.
 *   - 3분할이 아니라 5분할, 그 중 4곳이 위험구역(안전 구역 1곳뿐)이라 더 빡빡하다.
 *   - 패턴1 시전 주기·예고·판정 시간은 1페이즈와 동일(반응속도가 너무 빠르다는 피드백으로
 *     되돌림) — 어려워지는 건 순전히 구역 수와 무작위 전체패턴·발악 체크포인트뿐이다.
 *   - 1페이즈에서 HP 75/50/25%마다 뜨던 전체공격(패턴2)은 이제 그 타이밍과 무관하게
 *     무작위 주기로 튀어나온다(단, 패턴1과 절대 안 겹치게 겹침 방지 로직을 그대로 적용).
 *   - 그 대신 HP 75/50/25%마다 발악(패링)이 뜬다 — 1페이즈의 "죽으면 뜨는 최후의 한 번"과
 *     달리, 성공/실패해도 전투가 끝나지 않고(실패하면 목숨만 깎이고) 계속 이어지다가,
 *     HP가 0이 되는 순간 그게 곧 최종 승리다.
 *   - 발악(패링) 링은 1페이즈보다 천천히 좁혀져서(3.2초) 확실하게 보고 반응할 수 있다.
 */
export const BOSS_PHASE2 = {
  maxHp: 1280,
  baseDamage: 4,
  maxCombo: 50,
  comboDecayMs: 1500,
  maxDamageMultiplier: 3,
  zoneCount: 5,
  dangerZoneCount: 4,
  pattern1IntervalMs: 1600,
  pattern1WarnMs: 500,
  pattern1ActiveMs: 650,
  pattern1DeathPenalty: 1,
  pattern2RandomMinMs: 4000,
  pattern2RandomMaxMs: 7000,
  pattern2WarnMs: 1500,
  pattern2ActiveMs: 400,
  pattern2DeathPenalty: 3,
  checkpointThresholds: [0.75, 0.5, 0.25],
  checkpointRingDurationMs: 3200,
  checkpointWindowMs: 500,
  checkpointFailPenalty: 2,
  timeLimitMs: 3 * 60 * 1000,
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
