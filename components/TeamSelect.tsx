"use client";

import { useEffect, useState } from "react";
import { TEAMS, TEAM_IDS, TeamId } from "@/lib/game";
import { playTitleBgm, setTitleBgmMuted, stopTitleBgm } from "@/lib/bgm";
import VolumeButton from "./VolumeButton";

export default function TeamSelect({ onPick }: { onPick: (team: TeamId) => void }) {
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    playTitleBgm();
    return () => stopTitleBgm();
  }, []);

  useEffect(() => {
    setTitleBgmMuted(!soundOn);
  }, [soundOn]);

  return (
    <div className="select-screen">
      <VolumeButton on={soundOn} onClick={() => setSoundOn((v) => !v)} className="select-sound-btn" />

      <header className="select-head">
        <img
          src="/images/logo/title-logo.webp"
          alt="고연전 응원 클리커 — 모두가 두드리는 하나의 검"
          className="select-logo"
        />
        <p className="select-sub">당신의 여정을 선택하세요</p>
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
                  "--card-glow": t.colors.glow,
                } as React.CSSProperties
              }
            >
              <span className="team-name">{t.name}</span>
              <span className="team-short">{t.short}</span>
              <span className="team-slogan">{t.slogan}</span>
            </button>
          );
        })}
      </div>

      <p className="select-note">
        나의 염원은 같은 편 모두의 검법에 그대로 저장됩니다.
      </p>
    </div>
  );
}
