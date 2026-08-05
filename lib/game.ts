/**
 * 팀 테마와 숫자 표기.
 * 게임 수치·상태 계산은 lib/engine.ts에 있다.
 */

export type TeamId = "ku" | "yu";

export interface TeamTheme {
  id: TeamId;
  name: string;
  short: string;
  slogan: string;
  spirit: string; // 재화 이름
  emblem: string;
  /** 칼 7단계 이름 */
  stages: string[];
  colors: {
    primary: string;
    primaryDeep: string;
    accent: string;
    glow: string;
    bgFrom: string;
    bgTo: string;
  };
}

export const TEAM_IDS: TeamId[] = ["ku", "yu"];

export const TEAMS: Record<TeamId, TeamTheme> = {
  ku: {
    id: "ku",
    name: "고려대학교",
    short: "고대",
    slogan: "안암의 기운을 모아 승리의 검을 완성하라",
    spirit: "안암의 기운",
    emblem: "🐯",
    stages: [
      "낡은 연습검",
      "새내기의 검",
      "안암 단련검",
      "크림슨 응원검",
      "호랑이 발톱검",
      "고연전 승리검",
      "전설의 안암검",
    ],
    colors: {
      primary: "#a4142f",
      primaryDeep: "#6d0d20",
      accent: "#e8c46a",
      glow: "#ff4d6d",
      bgFrom: "#1a0509",
      bgTo: "#33070f",
    },
  },
  yu: {
    id: "yu",
    name: "연세대학교",
    short: "연대",
    slogan: "신촌의 기운을 모아 승리의 검을 완성하라",
    spirit: "신촌의 기운",
    emblem: "🦅",
    stages: [
      "낡은 연습검",
      "새내기의 검",
      "신촌 단련검",
      "블루 응원검",
      "독수리 날개검",
      "연고전 승리검",
      "전설의 신촌검",
    ],
    colors: {
      primary: "#12559c",
      primaryDeep: "#082c5a",
      accent: "#8fd0ff",
      glow: "#3aa0ff",
      bgFrom: "#030a17",
      bgTo: "#06203f",
    },
  },
};

/** 내가 어느 칼을 돕고 있는지 (이 기기에만 저장) */
const TEAM_KEY = "kyg.team";

export function loadTeam(): TeamId | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(TEAM_KEY);
  return value === "ku" || value === "yu" ? value : null;
}

export function saveTeam(team: TeamId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEAM_KEY, team);
  } catch {
    /* 사파리 프라이빗 모드 등 */
  }
}

export function clearTeam() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TEAM_KEY);
  } catch {
    /* noop */
  }
}

// ---------- 표기 ----------

const UNITS: [number, string][] = [
  [1e16, "경"],
  [1e12, "조"],
  [1e8, "억"],
  [1e4, "만"],
];

/** 한국식 큰 수 표기: 12345 → "1.2만" */
export function formatNumber(value: number): string {
  const n = Math.floor(value);
  if (n < 10_000) return n.toLocaleString("ko-KR");
  for (const [unit, label] of UNITS) {
    if (n >= unit) {
      const scaled = n / unit;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${scaled.toFixed(digits)}${label}`;
    }
  }
  return n.toLocaleString("ko-KR");
}

/** 초당 생산량처럼 소수점이 의미 있는 값 */
export function formatRate(value: number): string {
  if (value < 10) return value.toFixed(1);
  return formatNumber(value);
}
