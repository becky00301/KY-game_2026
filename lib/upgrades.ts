/**
 * 강화 항목의 표기 정보.
 * 실제 비용·증가량 수치는 lib/engine.ts(UPGRADE_NUMBERS)와 서버가 갖는다.
 */

export interface UpgradeLabel {
  id: string;
  name: string;
  icon: string;
}

export const TAP_LABELS: UpgradeLabel[] = [
  { id: "wrist", name: "손목 단련", icon: "✊" },
  { id: "stick", name: "응원봉 강화", icon: "🥁" },
  { id: "glove", name: "응원 장갑", icon: "🧤" },
  { id: "beast", name: "상징의 힘", icon: "🔥" },
];

export const AUTO_LABELS: UpgradeLabel[] = [
  { id: "fresh", name: "새내기 응원단", icon: "🎒" },
  { id: "dept", name: "과반 응원단", icon: "📣" },
  { id: "band", name: "풍물패", icon: "🥢" },
  { id: "senior", name: "교우회 선배단", icon: "🎓" },
  { id: "choir", name: "대합창단", icon: "🎶" },
];
