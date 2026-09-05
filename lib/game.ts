/**
 * 팀 테마와 숫자 표기.
 * 게임 수치·상태 계산은 lib/engine.ts에 있다.
 */

export type TeamId = "ku" | "yu";

/**
 * 팀별 문구 오버라이드. 값이 없으면(undefined) 화면 쪽에서 기존 공통 문구로 폴백한다.
 * 거의 모든 팀별 텍스트 커스터마이징은 이 객체 하나를 통해 이뤄진다.
 */
export interface TeamCopy {
  badgeLabel?: string; // 상단 배지 텍스트 ("OO 공동 칼" 대체)
  galleryTitle?: string; // 도감 시트 제목
  gallerySheetNote?: string; // 도감 시트 안내문
  upgradeSheetLabel?: string; // 강화 시트 상단 라벨
  upgradeSheetNote?: string; // 강화 시트 안내문
  upgradeBtnLabel?: string; // 메인 강화 버튼 텍스트
  tapTabLabel?: string; // 강화탭 "터치" 라벨
  autoTabLabel?: string; // 강화탭 "자동" 라벨
  hideSheetStats?: boolean; // true면 강화시트 하단 "OO 전체 N번" 줄 숨김
  stageHintNext?: string; // "다음 OO까지" 접두
  stageHintMax?: string; // 별 5개 다 채운 뒤 고정 문구
  revealKicker?: (short: string) => string; // 진화 팝업 상단 문구
  unlockLabel?: (n: number) => string; // 진화 팝업 "카드 N번 해금" 대체
  continueLabel?: string; // 진화 팝업 하단 버튼 텍스트
  tapHint?: (n: string) => string; // "OO 전체가 두드린 N번" 대체
  contribLine?: (n: string) => string; // "내가 보탠 N번" 대체
  feverIdle?: (pct: number) => string; // 피버 대기중 게이지 문구
  feverActiveText?: string; // 피버 활성중 고정 문구
}

export interface TeamTheme {
  id: TeamId;
  name: string;
  short: string;
  slogan: string;
  spirit: string; // 재화 이름
  emblem: string;
  /** 칼 5단계 이름 */
  stages: string[];
  copy: TeamCopy;
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
    name: "진홍과 여명의 검법",
    short: "고대",
    slogan: "타오르는 노을과 진리의 여정",
    spirit: "염원의 힘",
    emblem: "🐯",
    stages: [
      "성화가 시작될 검",
      "홍련과 개화를 이룬 검",
      "진홍과 여명을 비출 검",
      "삼휘를 개벽해낼 검",
      "영겁과 휘광을 불러오는 검",
    ],
    copy: {
      badgeLabel: "노아의 검",
      galleryTitle: "진홍과 여명의 이야기",
      gallerySheetNote: "염원이 모일수록, 검법에 담겨진 이야기가 공개됩니다.",
      upgradeSheetLabel: "진홍 여명 검법의 비술",
      upgradeSheetNote: "검법에 숨겨진 비술을 획득하세요. 비술은 모두에게 적용됩니다.",
      upgradeBtnLabel: "비술 획득하기",
      tapTabLabel: "타격 강화",
      autoTabLabel: "자동 타격",
      hideSheetStats: true,
      stageHintNext: "다음 단계까지",
      stageHintMax: "비술의 성장은 끝났다. 이제는 운명을 써내려갈 차례다.",
      revealKicker: () => "비술이 강화되며, 숨겨진 이야기가 드러났다.",
      unlockLabel: (n) => `${n}번째 이야기 개방`,
      continueLabel: "계속 단련하기",
      tapHint: (n) => `모두의 염원이 ${n}만큼 모여있습니다.`,
      contribLine: (n) => `나의 염원 : ${n}`,
      feverIdle: (pct) => `여명의 빛이 밝을 때까지 ${pct}%`,
      feverActiveText: "여명이 찾아오며, 염원 획득량이 3배가 된다.",
    },
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
    name: "천청과 비상의 검법",
    short: "연대",
    slogan: "비상하는 진리와 자유의 여정",
    spirit: "데이터베이스",
    emblem: "🦅",
    stages: [
      "프로토타입 : 청우",
      "개화 : 연희와 검",
      "청천 : 비상하는 검",
      "창천 : 개벽하는 검",
      "엔드 : 무궁과 천상의 검",
    ],
    copy: {
      badgeLabel: "연의 검",
      galleryTitle: "천청과 비상의 이야기",
      gallerySheetNote: "검이 업그레이드 될 수록, 검법에 담겨진 이야기가 공개됩니다.",
      upgradeSheetLabel: "천청 비상 검법 모듈 시스템",
      upgradeSheetNote: "검법에 업그레이드 모듈을 장착하세요. 모듈은 모두에게 적용됩니다.",
      upgradeBtnLabel: "모듈 업그레이드",
      tapTabLabel: "타격 업그레이드",
      autoTabLabel: "자동 타격 시스템",
      hideSheetStats: true,
      stageHintNext: "다음 업그레이드까지",
      stageHintMax: "비술의 업그레이드가 완료되었다. 이제는 미래를 써내려 갈 시간이다.",
      revealKicker: () => "검술 업그레이드 완료. 비화를 공개합니다.",
      unlockLabel: (n) => `${n}번째 이야기 개방`,
      continueLabel: "계속 단련하기",
      tapHint: (n) => `모두의 데이터가 ${n}만큼 수집되었습니다.`,
      contribLine: (n) => `나의 데이터 : ${n}`,
      feverIdle: (pct) => `폭주 시스템 가동까지 ${pct}%`,
      feverActiveText: "폭주 시스템 가동. 데이터를 3배 획득합니다.",
    },
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

/** 튜토리얼(첫 진입 대화 연출)을 이미 봤는지 — 팀별로, 이 기기에만 저장 */
function seenKey(prefix: string, team: TeamId) {
  return `kyg.${prefix}.${team}`;
}

export function hasSeenTutorial(team: TeamId): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(seenKey("tutorialSeen", team)) === "1";
}

export function markTutorialSeen(team: TeamId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(seenKey("tutorialSeen", team), "1");
  } catch {
    /* noop */
  }
}

/** 5단계 도달 컷씬을 이미 봤는지 — 팀별로, 이 기기에만 저장 */
export function hasSeenEvolveCutscene(team: TeamId): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(seenKey("evolveCutsceneSeen", team)) === "1";
}

export function markEvolveCutsceneSeen(team: TeamId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(seenKey("evolveCutsceneSeen", team), "1");
  } catch {
    /* noop */
  }
}

/**
 * 학교 심볼 이미지. 검이 최종 단계에 도달하면(`evolved`) 진화한 심볼로 바뀐다.
 * "OO 공동 칼" 배지와 도감 카드 폴백 아이콘 두 곳에서 같이 쓴다.
 */
export function emblemSrc(team: TeamId, evolved: boolean): string {
  return `/images/emblem/emblem-${team}${evolved ? "-stage5" : ""}.webp`;
}

/** "#ff4d6d" → "255, 77, 109" — rgba()에서 커스텀 알파를 쓰려면 채널 문자열이 따로 필요하다. */
export function hexToRgbString(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
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
