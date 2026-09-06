"use client";

import { TeamId, TeamTheme, formatNumber } from "@/lib/game";

export interface PipFloater {
  id: number;
  text: string;
  left: number;
  critical: boolean;
}

/**
 * PIP 창 안에 그리는 축소 뷰. 메인 게임 화면을 그대로 옮기는 게 아니라 팀 배지·에너지·검 이미지·
 * 터치 영역·돌아가기 버튼만 있는 미니멀 구성이다. sword/stage는 메인 화면과 완전히 같은 상태를
 * 그대로 받아서 보여주므로, 여기서 두드리면 메인 화면과 동일하게 반영된다.
 */
export default function PipView({
  theme,
  team,
  energy,
  stage,
  floaters,
  onTap,
  onReturn,
}: {
  theme: TeamTheme;
  team: TeamId;
  energy: number;
  stage: number;
  floaters: PipFloater[];
  onTap: () => void;
  onReturn: () => void;
}) {
  const swordSrc = `/images/sword/sword-${team}-stage${Math.min(stage, 4)}.webp`;

  return (
    <div
      className="pip-root"
      style={
        {
          "--primary": theme.colors.primary,
          "--accent": theme.colors.accent,
          "--glow": theme.colors.glow,
          "--bg-from": theme.colors.bgFrom,
          "--bg-to": theme.colors.bgTo,
        } as React.CSSProperties
      }
    >
      <header className="pip-header">
        <span className="pip-team">{theme.copy.badgeLabel ?? `${theme.short} 공동 칼`}</span>
        <span className="pip-energy">{formatNumber(energy)}</span>
      </header>

      <button
        className="pip-tap-area"
        onPointerDown={(e) => {
          e.preventDefault();
          onTap();
        }}
        aria-label="검 두드리기"
      >
        <div className="pip-floater-layer">
          {floaters.map((f) => (
            <span
              key={f.id}
              className={`pip-floater ${f.critical ? "critical" : ""}`}
              style={{ left: `${f.left}%` }}
            >
              {f.text}
            </span>
          ))}
        </div>
        <img className="pip-sword-img" src={swordSrc} alt="" draggable={false} />
      </button>

      <button className="pip-return-btn" onClick={onReturn}>
        원래대로 돌아가기
      </button>
    </div>
  );
}
