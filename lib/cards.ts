/**
 * 칼 단계마다 공개되는 일러스트 카드.
 *
 * 공동 칼이므로 해금 여부는 개인 기록이 아니라 팀의 현재 단계로 정해진다.
 * 즉 누군가 진화를 이뤄내면 그 팀 전원에게 같은 카드가 열린다.
 *
 * 이미지는 public/cards/<팀>/<단계>.png 에 넣는다. 파일이 없으면
 * 카드 자리에 단계 이름만 있는 대체 화면이 나오므로 그림 없이도 동작한다.
 */

import { TeamId } from "./game";

export interface CardInfo {
  stage: number;
  /** 카드 이름 — 기본값은 칼 단계 이름을 쓴다 */
  title: string;
  /** 카드에 곁들이는 한 줄 */
  caption: string;
  /** 그린 사람 표기. 넣으면 카드 하단에 크레딧이 나온다 */
  artist?: string;
  image: string;
}

const CAPTIONS: Record<TeamId, string[]> = {
  ku: [
    "아직 아무 기운도 담기지 않은 검.",
    "처음으로 안암의 기운이 깃들었다.",
    "수없이 두드려 단단해진 날.",
    "크림슨이 칼날을 타고 번진다.",
    "호랑이의 발톱이 검에 새겨졌다.",
    "고연전을 위해 벼려진 검.",
    "안암의 모든 기운이 하나로 모였다.",
  ],
  yu: [
    "아직 아무 기운도 담기지 않은 검.",
    "처음으로 신촌의 기운이 깃들었다.",
    "수없이 두드려 단단해진 날.",
    "푸른 기운이 칼날을 타고 번진다.",
    "독수리의 날개가 검에 새겨졌다.",
    "연고전을 위해 벼려진 검.",
    "신촌의 모든 기운이 하나로 모였다.",
  ],
};

/** 그린 사람 표기 — 카드마다 다르면 여기서 단계별로 지정한다. */
const ARTISTS: Record<TeamId, (string | undefined)[]> = {
  ku: [undefined, undefined, undefined, undefined, undefined, undefined, undefined],
  yu: [undefined, undefined, undefined, undefined, undefined, undefined, undefined],
};

export function cardsFor(team: TeamId, stageNames: string[]): CardInfo[] {
  return stageNames.map((title, stage) => ({
    stage,
    title,
    caption: CAPTIONS[team][stage] ?? "",
    artist: ARTISTS[team][stage],
    image: `/cards/${team}/${stage}.png`,
  }));
}
