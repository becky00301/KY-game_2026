"use client";

import { useEffect, useState } from "react";
import GameScreen from "@/components/GameScreen";
import SetupNotice from "@/components/SetupNotice";
import TeamSelect from "@/components/TeamSelect";
import TutorialIntro from "@/components/TutorialIntro";
import { isMisconfigured } from "@/lib/backend";
import { TeamId, clearTeam, hasSeenTutorial, loadTeam, markTutorialSeen, saveTeam } from "@/lib/game";

export default function Page() {
  const [team, setTeam] = useState<TeamId | null>(null);
  const [ready, setReady] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [justFinishedTutorial, setJustFinishedTutorial] = useState(false);

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
          setJustFinishedTutorial(false);
          setShowTutorial(!hasSeenTutorial(picked));
        }}
      />
    );
  }

  // 진영을 처음 고를 때 1회만 나오는 대화 연출 — 끝나면 게임 화면 진입 직후 1단계 카드 팝업도 자동으로 뜬다.
  if (showTutorial) {
    return (
      <TutorialIntro
        team={team}
        onDone={() => {
          markTutorialSeen(team);
          setShowTutorial(false);
          setJustFinishedTutorial(true);
        }}
      />
    );
  }

  return (
    <GameScreen
      key={team}
      team={team}
      justFinishedTutorial={justFinishedTutorial}
      onChangeTeam={() => {
        clearTeam();
        setTeam(null);
        setShowTutorial(false);
        setJustFinishedTutorial(false);
      }}
    />
  );
}
