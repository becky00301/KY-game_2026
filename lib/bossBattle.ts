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

/** 전부 임시값 — 실제 플레이테스트 후 조정 권장. */
export const BOSS_BATTLE = {
  maxHp: 1300,
  baseDamage: 4,
  maxCombo: 50,
  comboDecayMs: 1500,
  maxDamageMultiplier: 3,
  maxDeathCount: 5,
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

export type Orientation = "vertical" | "horizontal" | "diagonal";
export type ZoneIndex = 0 | 1 | 2;

/** 탭 좌표(각 축 0~1로 정규화)를 3분할 구역 중 하나로 매핑한다. */
export function zoneOf(orientation: Orientation, xFrac: number, yFrac: number): ZoneIndex {
  if (orientation === "vertical") return Math.min(2, Math.floor(xFrac * 3)) as ZoneIndex;
  if (orientation === "horizontal") return Math.min(2, Math.floor(yFrac * 3)) as ZoneIndex;
  const d = xFrac + yFrac;
  if (d < 2 / 3) return 0;
  if (d < 4 / 3) return 1;
  return 2;
}

/** 콤보(0~maxCombo)에 비례한 데미지 배수 — 1배 ~ maxDamageMultiplier배. */
export function damageMultiplier(combo: number): number {
  return 1 + (combo / BOSS_BATTLE.maxCombo) * (BOSS_BATTLE.maxDamageMultiplier - 1);
}

/** 패턴1의 위험구역 2곳을 무작위로 고른다. */
export function pickDangerZones(): [ZoneIndex, ZoneIndex] {
  const zones: ZoneIndex[] = [0, 1, 2];
  const first = zones.splice(Math.floor(Math.random() * zones.length), 1)[0];
  const second = zones[Math.floor(Math.random() * zones.length)];
  return [first, second];
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

/** 발악 판정의 유효 시간창(시작~끝, ms) — finaleRingDurationMs 근방 ±finaleWindowMs/2. */
export function finaleWindow(): { start: number; end: number } {
  const half = BOSS_BATTLE.finaleWindowMs / 2;
  return { start: BOSS_BATTLE.finaleRingDurationMs - half, end: BOSS_BATTLE.finaleRingDurationMs + half };
}
