"use client";

import { useState } from "react";
import { CardInfo } from "@/lib/cards";
import { TeamTheme, emblemSrc } from "@/lib/game";

/**
 * 카드 그림. 아직 이미지 파일이 없으면 단계 이름만 있는 대체 화면을 보여준다.
 * 덕분에 일러스트가 준비되기 전에도 진화 연출과 도감이 그대로 돌아간다.
 *
 * 배경엔 블러 처리된 같은 그림을 깔고(칸을 꽉 채움), 그 위에 원본 비율 그대로인
 * 선명한 그림을 얹는다(절대 안 잘림) — "블러 배경 + 선명한 원본" 2겹 구조.
 */
export default function CardArt({
  card,
  theme,
  locked = false,
  emblemEvolved = false,
  grand = false,
}: {
  card: CardInfo;
  theme: TeamTheme;
  locked?: boolean;
  /** 팀의 검이 최종 단계에 도달했으면 폴백 아이콘도 진화한 심볼로 보여준다 */
  emblemEvolved?: boolean;
  /** 5단계(이후) 카드를 단일 포커스 뷰에서 훨씬 큰 정사각형 틀로 보여줄 때 */
  grand?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const grandClass = grand ? "card-art-grand" : "";

  if (locked) {
    return (
      <div className={`card-art locked ${grandClass}`}>
        <span className="card-lock">?</span>
      </div>
    );
  }

  if (failed) {
    return (
      <div className={`card-art fallback ${grandClass}`}>
        <img className="card-emblem" src={emblemSrc(theme.id, emblemEvolved)} alt="" />
        <span className="card-fallback-title">{card.title}</span>
        <span className="card-fallback-note">일러스트 준비 중</span>
      </div>
    );
  }

  return (
    <div className={`card-art card-art-photo ${grandClass}`}>
      <img className="card-art-bg" src={card.image} alt="" aria-hidden="true" />
      <img className="card-art-img" src={card.image} alt={card.title} onError={() => setFailed(true)} />
    </div>
  );
}
