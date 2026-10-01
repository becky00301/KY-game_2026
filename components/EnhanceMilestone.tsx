"use client";

import { ENHANCE_ITEM } from "@/lib/enhance";
import { TeamId } from "@/lib/game";

/**
 * 강화 23단계 이상 성공 시 화면 최상단에 뜨는 웅장한 전체 알림 — 함성·운영자 공지보다도
 * 위(z-index 최상단)에 뜬다. 노아든 연이든 상관없이 양쪽 화면 모두에 똑같이 뜬다.
 * 부모가 일정 시간 뒤 unmount한다.
 */
export function EnhanceMilestoneBanner({ team, nickname, level }: { team: TeamId; nickname: string; level: number }) {
  const itemName = ENHANCE_ITEM[team].name;
  return (
    <div className="milestone-banner" role="status">
      <span className="milestone-banner-rays" aria-hidden="true" />
      <span className="milestone-banner-glow" aria-hidden="true" />
      <p className="milestone-banner-text">
        <strong className="milestone-banner-name">{nickname}</strong>님이 {itemName}{" "}
        <strong className="milestone-banner-level">{level}단계</strong> 강화에 성공하셨습니다!
      </p>
    </div>
  );
}
