"use client";

import { useState } from "react";
import { TEAMS, TeamId } from "@/lib/game";

interface TutorialData {
  name: string;
  side: "left" | "right";
  standeeSrc: string;
  lines: string[];
}

const TUTORIALS: Record<TeamId, TutorialData> = {
  ku: {
    name: "노아",
    side: "right",
    standeeSrc: "/images/standee/ku-tutorial-standee.webp",
    lines: [
      "당신이군요.. 이 검의 주인이. 기다리고있었어요.",
      "이 검에는 진홍과 여명이 깃들어있어요. 고대로부터 내려져온, 전설의 비검이랍니다. 이번에는 검이 당신을 선택한 것 같아요.",
      "이 검은 쉽게 사용할 수 없답니다. 검을 터치해서 염원을 만들어내고, 모두와 함께 검법을 익혀주세요. 검은 반드시, 당신의 의지를 따르게 될거에요.",
      "이렇게 모인 염원은, 검의 비술을 익히고 강화하는 곳에 사용할 수 있습니다.",
      "또, 당신이 검법을 익혀갈수록.. 저에 대한 이야기를 들을 수 있을거에요.",
      "뭇별의 너머에서 기다리고 있겠습니다. 여행자님.",
      "기억해요. 여명은, 혼자서는 밝힐 수 없다는 것을...",
    ],
  },
  yu: {
    name: "연",
    side: "left",
    standeeSrc: "/images/standee/yu-tutorial-standee.webp",
    lines: [
      "...! 드디어 찾았군. 기다리고있었다.",
      "네가 바로.. 천청검법 프로토콜을 완성시킬 녀석이로구나.",
      "너에게 천청검법의 정수가 담긴 <청우>를 전송했다. 검을 터치해서 데이터를 쌓고, 모두와 함께 공유하여 검술을 강화하도록.",
      "데이터가 많아질수록, 검술에 적용할 수 있는 모듈을 업그레이드 할 수 있을거야.",
      "검술이 완성될 때 마다.. 나의 목적과 진실을 알게될지도 모르지.",
      "뭇별의 너머에서 기다리겠다, 여행자. 청우를 부탁할게.",
      "기억해. 승리를 비출 서광은, 모두에게 달려있다는 걸.",
    ],
  },
};

/**
 * 진영을 처음 고를 때 1회만 나오는 대화 연출.
 * 배경은 완전 암전이 아니라 그 팀의 1단계 게임 배경 위에 스크림을 얹어 은은하게 비치게 한다.
 */
export default function TutorialIntro({ team, onDone }: { team: TeamId; onDone: () => void }) {
  const [line, setLine] = useState(0);
  const data = TUTORIALS[team];
  const theme = TEAMS[team];
  const bgImage = `/images/bg/bg-${team}-stage0-1.webp`;

  const advance = () => {
    if (line >= data.lines.length - 1) {
      onDone();
      return;
    }
    setLine((l) => l + 1);
  };

  return (
    <div
      className="tutorial-vn"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(5,2,8,0.5) 0%, rgba(5,2,8,0.3) 45%, rgba(5,2,8,0.72) 100%), url("${bgImage}")`,
      }}
      onClick={advance}
    >
      <button
        className="tutorial-skip"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        건너뛰기
      </button>

      <img className={`tutorial-standee side-${data.side}`} src={data.standeeSrc} alt="" />

      <div className="tutorial-dialogue" style={{ "--card-accent": theme.colors.accent } as React.CSSProperties}>
        <p className="tutorial-name">{data.name}</p>
        <p className="tutorial-line">{data.lines[line]}</p>
        <p className="tutorial-next-hint">탭하여 계속</p>
      </div>
    </div>
  );
}
