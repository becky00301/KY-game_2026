/**
 * 칼 단계마다 공개되는 일러스트 카드.
 *
 * 공동 칼이므로 해금 여부는 개인 기록이 아니라 팀의 현재 단계로 정해진다.
 * 즉 누군가 진화를 이뤄내면 그 팀 전원에게 같은 카드가 열린다.
 *
 * 이미지는 public/images/gallery/<팀>-stage<1~5>.webp 에 있다. 파일이 없으면
 * 카드 자리에 단계 이름만 있는 대체 화면이 나오므로 그림 없이도 동작한다.
 */

import { TeamId } from "./game";

export interface CardInfo {
  stage: number;
  /** 카드 이름 — 기본값은 칼 단계 이름을 쓴다 */
  title: string;
  /** 카드에 곁들이는 한 줄 */
  caption: string;
  /** 카드 상세보기에서 캡션 아래 스크롤 박스로 보여주는 세계관 텍스트. 없으면 박스 자체를 숨긴다. */
  lore?: string;
  /** 그린 사람 표기. 넣으면 카드 하단에 크레딧이 나온다 */
  artist?: string;
  image: string;
  /** 후일담 보너스 카드 여부 — true면 잠금 판정이 단계가 아니라 별 개수로 바뀐다 */
  bonus?: boolean;
  /** 보너스 카드 해금에 필요한 별 개수 */
  requiredStars?: number;
}

const CAPTIONS: Record<TeamId, string[]> = {
  ku: [
    "새로운 전설이 시작될 검.",
    "자유와 정의, 진리를 추구하던 한 검사의 이야기.",
    "과거와 전통은 결코 무너지지 않는다.",
    "청춘을 바치고, 세계를 빛낼 검이 되어라.",
    "모두의 염원은 승리를 비출 최초의 광휘가 된다.",
  ],
  yu: [
    "미래를 새롭게 써내려 갈 검.",
    "전설로 거듭난 미래, 그 뒤에는 외로움이 숨어있었다.",
    "진리는 자유를 평정하리라.",
    "모두의 염원은, 미래로 나아갈 가장 합리적인 데이터다.",
    "미래를 향해 비상해라. 전설은 당신의 손에 의해 쓰여질 것이다.",
  ],
};

/**
 * 도감 카드 상세보기용 세계관 로어 텍스트.
 *
 * ⚠️ 2차 SPEC.md 3번 항목: 원문은 데모 HTML의 `CARD_LORE` 상수에 있고 "그대로 복사"하라고
 * 되어 있는데, 그 데모 HTML이 이 handoff에는 포함돼 있지 않아서 지금은 비워둔다.
 * 값이 없으면(undefined) 상세보기에서 로어 박스 자체가 안 보이므로 화면은 정상 동작한다.
 * 원문 텍스트를 받으면 team당 5개(단계 순서) 문자열로 채우면 된다.
 */
const CARD_LORE: Record<TeamId, string[]> = {
  ku: [],
  yu: [],
};

/** 그린 사람 표기 — 카드마다 다르면 여기서 단계별로 지정한다. */
const ARTISTS: Record<TeamId, (string | undefined)[]> = {
  ku: [undefined, undefined, undefined, undefined, undefined],
  yu: [undefined, undefined, undefined, undefined, undefined],
};

export function cardsFor(team: TeamId, stageNames: string[]): CardInfo[] {
  return stageNames.map((title, stage) => ({
    stage,
    title,
    caption: CAPTIONS[team][stage] ?? "",
    lore: CARD_LORE[team][stage],
    artist: ARTISTS[team][stage],
    image: `/images/gallery/${team}-stage${stage + 1}.webp`,
  }));
}

/** 도감 6번째 칸 — 연마(별) 5개를 채워야 열리는 후일담 보너스 카드. */
const BONUS_CARDS: Record<TeamId, { title: string; requiredStars: number }> = {
  ku: { title: "후일담 : 아리아의 전언", requiredStars: 5 },
  yu: { title: "후일담 : 연희의 기록 - 2080년으로부터", requiredStars: 5 },
};

/**
 * 후일담 카드. `stage`는 일반 카드 뒤에 오도록 stageNames.length를 그대로 쓴다
 * (일러스트가 실제 5단계보다 한 칸 뒤라 "웅장 모드"(stage >= 4) 조건에도 자동으로 걸린다).
 */
export function bonusCardFor(team: TeamId, stageNames: string[]): CardInfo {
  const def = BONUS_CARDS[team];
  return {
    stage: stageNames.length,
    title: def.title,
    caption: "",
    artist: undefined,
    image: `/images/gallery/${team}-bonus.webp`,
    bonus: true,
    requiredStars: def.requiredStars,
  };
}

/** 카드 잠금 여부. 보너스 카드는 단계가 아니라 (최종 단계 도달 + 별 개수)로 판정한다. */
export function isCardLocked(card: CardInfo, stage: number, stars: number, maxStage: number): boolean {
  if (card.bonus) return !(stage >= maxStage && stars >= (card.requiredStars ?? 0));
  return card.stage > stage;
}
