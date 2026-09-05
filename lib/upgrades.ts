/**
 * 강화 항목의 표기 정보. 팀별로 이름이 다르다.
 * 실제 비용·증가량 수치는 lib/engine.ts(UPGRADE_NUMBERS)와 서버가 갖는다.
 */

import { TeamId } from "./game";

export interface UpgradeLabel {
  id: string;
  name: string;
  /** 이모지 폴백 — iconImg가 있으면 그쪽을 우선 쓴다 */
  icon: string;
  /** 실제 아이콘 이미지. 없으면 icon(이모지)으로 폴백 */
  iconImg?: string;
}

/** 타격 강화 — 팀별로 4개 항목 전부 하나의 이미지로 통일 */
const TAP_ICON_IMG: Record<TeamId, string> = {
  ku: "/images/icons-upgrade/tap-icon-ku-unified.webp",
  yu: "/images/icons-upgrade/tap-icon-yu-unified.webp",
};

export const TAP_LABELS: Record<TeamId, UpgradeLabel[]> = {
  ku: [
    { id: "wrist", name: "나아갈 용기", icon: "✊", iconImg: TAP_ICON_IMG.ku },
    { id: "stick", name: "포기하지 않을 의지", icon: "🥁", iconImg: TAP_ICON_IMG.ku },
    { id: "glove", name: "진실을 꿰뚫을 지혜", icon: "🧤", iconImg: TAP_ICON_IMG.ku },
    { id: "beast", name: "전설로 거듭날 운명", icon: "🔥", iconImg: TAP_ICON_IMG.ku },
  ],
  yu: [
    { id: "wrist", name: "타격 : 푸른 궤도", icon: "✊", iconImg: TAP_ICON_IMG.yu },
    { id: "stick", name: "타격 : 진리의 코드", icon: "🥁", iconImg: TAP_ICON_IMG.yu },
    { id: "glove", name: "타격 : 임계점 돌파", icon: "🧤", iconImg: TAP_ICON_IMG.yu },
    { id: "beast", name: "타격 : 라그나로크", icon: "🔥", iconImg: TAP_ICON_IMG.yu },
  ],
};

/** 자동 강화 — 항목마다 서로 다른 이미지 (팀별로 완전히 다른 세트) */
const AUTO_ICON_SRC: Record<TeamId, Record<string, string>> = {
  ku: {
    fresh: "/images/icons-upgrade/auto-icon-ku-fresh.webp",
    dept: "/images/icons-upgrade/auto-icon-ku-dept.webp",
    band: "/images/icons-upgrade/auto-icon-ku-band.webp",
    senior: "/images/icons-upgrade/auto-icon-ku-senior.webp",
    choir: "/images/icons-upgrade/auto-icon-ku-choir.webp",
  },
  yu: {
    fresh: "/images/icons-upgrade/auto-icon-yu-fresh.webp",
    dept: "/images/icons-upgrade/auto-icon-yu-dept.webp",
    band: "/images/icons-upgrade/auto-icon-yu-band.webp",
    senior: "/images/icons-upgrade/auto-icon-yu-senior.webp",
    choir: "/images/icons-upgrade/auto-icon-yu-choir.webp",
  },
};

export const AUTO_LABELS: Record<TeamId, UpgradeLabel[]> = {
  ku: [
    { id: "fresh", name: "증명된 용기", icon: "🎒", iconImg: AUTO_ICON_SRC.ku.fresh },
    { id: "dept", name: "벼려낸 의지", icon: "📣", iconImg: AUTO_ICON_SRC.ku.dept },
    { id: "band", name: "깨어난 지혜", icon: "🥢", iconImg: AUTO_ICON_SRC.ku.band },
    { id: "senior", name: "아리아의 전설", icon: "🎓", iconImg: AUTO_ICON_SRC.ku.senior },
    { id: "choir", name: "노아의 의지를 이어받은자", icon: "🎶", iconImg: AUTO_ICON_SRC.ku.choir },
  ],
  yu: [
    { id: "fresh", name: "영원의 회로", icon: "🎒", iconImg: AUTO_ICON_SRC.yu.fresh },
    { id: "dept", name: "공명 : 온누리", icon: "📣", iconImg: AUTO_ICON_SRC.yu.dept },
    { id: "band", name: "제로 : 바운더리", icon: "🥢", iconImg: AUTO_ICON_SRC.yu.band },
    { id: "senior", name: "천공 : 자유의 벡터", icon: "🎓", iconImg: AUTO_ICON_SRC.yu.senior },
    { id: "choir", name: "연의 의지를 이어받은자", icon: "🎶", iconImg: AUTO_ICON_SRC.yu.choir },
  ],
};
