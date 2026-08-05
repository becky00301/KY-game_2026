"use client";

import { useEffect, useState } from "react";
import GameScreen from "@/components/GameScreen";
import SetupNotice from "@/components/SetupNotice";
import TeamSelect from "@/components/TeamSelect";
import { isMisconfigured } from "@/lib/backend";
import { TeamId, clearTeam, loadTeam, saveTeam } from "@/lib/game";

export default function Page() {
  const [team, setTeam] = useState<TeamId | null>(null);
  const [ready, setReady] = useState(false);

  // localStorage는 클라이언트에서만 읽는다 (하이드레이션 불일치 방지)
  useEffect(() => {
    setTeam(loadTeam());
    setReady(true);
  }, []);

  if (isMisconfigured) {
    return <SetupNotice />;
  }

  if (!ready) {
    return <div className="boot" />;
  }

  if (!team) {
    return (
      <TeamSelect
        onPick={(picked: TeamId) => {
          saveTeam(picked);
          setTeam(picked);
        }}
      />
    );
  }

  return (
    <GameScreen
      key={team}
      team={team}
      onChangeTeam={() => {
        clearTeam();
        setTeam(null);
      }}
    />
  );
}
