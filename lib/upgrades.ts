/**
 * 강화 항목의 표기 정보. 팀별로 이름이 다르다.
 * 실제 비용·증가량 수치는 lib/engine.ts(UPGRADE_NUMBERS)와 서버가 갖는다.
 */

import { TeamId } from "./game";

export interface UpgradeLabel {
  id: string;
  name: string;
  icon: string;
}

export const TAP_LABELS: Record<TeamId, UpgradeLabel[]> = {
  ku: [
    { id: "wrist", name: "나아갈 용기", icon: "✊" },
    { id: "stick", name: "포기하지 않을 의지", icon: "🥁" },
    { id: "glove", name: "진실을 꿰뚫을 지혜", icon: "🧤" },
    { id: "beast", name: "전설로 거듭날 운명", icon: "🔥" },
  ],
  yu: [
    { id: "wrist", name: "타격 : 푸른 궤도", icon: "✊" },
    { id: "stick", name: "타격 : 진리의 코드", icon: "🥁" },
    { id: "glove", name: "타격 : 임계점 돌파", icon: "🧤" },
    { id: "beast", name: "타격 : 라그나로크", icon: "🔥" },
  ],
};

export const AUTO_LABELS: Record<TeamId, UpgradeLabel[]> = {
  ku: [
    { id: "fresh", name: "증명된 용기", icon: "🎒" },
    { id: "dept", name: "벼려낸 의지", icon: "📣" },
    { id: "band", name: "깨어난 지혜", icon: "🥢" },
    { id: "senior", name: "아리아의 전설", icon: "🎓" },
    { id: "choir", name: "노아의 의지를 이어받은자", icon: "🎶" },
  ],
  yu: [
    { id: "fresh", name: "영원의 회로", icon: "🎒" },
    { id: "dept", name: "공명 : 온누리", icon: "📣" },
    { id: "band", name: "제로 : 바운더리", icon: "🥢" },
    { id: "senior", name: "천공 : 자유의 벡터", icon: "🎓" },
    { id: "choir", name: "연의 의지를 이어받은자", icon: "🎶" },
  ],
};
