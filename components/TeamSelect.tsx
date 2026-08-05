"use client";

import { TEAMS, TEAM_IDS, TeamId } from "@/lib/game";

export default function TeamSelect({ onPick }: { onPick: (team: TeamId) => void }) {
  return (
    <div className="select-screen">
      <header className="select-head">
        <p className="select-kicker">고연전 응원 클리커</p>
        <h1 className="select-title">
          모두가 두드리는
          <br />
          하나의 검
        </h1>
        <p className="select-sub">어느 쪽 칼을 함께 키울지 고르세요</p>
      </header>

      <div className="team-cards">
        {TEAM_IDS.map((id) => {
          const t = TEAMS[id];
          return (
            <button
              key={id}
              className="team-card"
              onClick={() => onPick(id)}
              style={
                {
                  "--card-primary": t.colors.primary,
                  "--card-deep": t.colors.primaryDeep,
                  "--card-accent": t.colors.accent,
                } as React.CSSProperties
              }
            >
              <span className="team-emblem">{t.emblem}</span>
              <span className="team-name">{t.name}</span>
              <span className="team-short">{t.short}</span>
              <span className="team-slogan">{t.slogan}</span>
            </button>
          );
        })}
      </div>

      <p className="select-note">
        가입 없이 바로 시작합니다. 내 터치는 같은 편 모두의 칼에 그대로 쌓여요.
      </p>
    </div>
  );
}
