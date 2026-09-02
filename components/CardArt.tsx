"use client";

import { useState } from "react";
import { CardInfo } from "@/lib/cards";
import { TeamTheme, emblemSrc } from "@/lib/game";

/**
 * 카드 그림. 아직 이미지 파일이 없으면 단계 이름만 있는 대체 화면을 보여준다.
 * 덕분에 일러스트가 준비되기 전에도 진화 연출과 도감이 그대로 돌아간다.
 */
export default function CardArt({
  card,
  theme,
  locked = false,
  emblemEvolved = false,
}: {
  card: CardInfo;
  theme: TeamTheme;
  locked?: boolean;
  /** 팀의 검이 최종 단계에 도달했으면 폴백 아이콘도 진화한 심볼로 보여준다 */
  emblemEvolved?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (locked) {
    return (
      <div className="card-art locked">
        <span className="card-lock">?</span>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="card-art fallback">
        <img className="card-emblem" src={emblemSrc(theme.id, emblemEvolved)} alt="" />
        <span className="card-fallback-title">{card.title}</span>
        <span className="card-fallback-note">일러스트 준비 중</span>
      </div>
    );
  }

  return (
    <div className="card-art">
      {/* 픽셀 아트가 흐려지지 않도록 image-rendering을 CSS에서 지정한다 */}
      <img src={card.image} alt={card.title} onError={() => setFailed(true)} />
    </div>
  );
}
