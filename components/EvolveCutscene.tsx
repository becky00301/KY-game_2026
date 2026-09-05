"use client";

import { useEffect, useRef, useState } from "react";
import { TeamId } from "@/lib/game";

interface CutsceneData {
  lines: { name: string; text: string }[];
  imageSrc: string;
  caption: string;
}

export const EVOLVE_CUTSCENES: Record<TeamId, CutsceneData> = {
  ku: {
    lines: [
      { name: "나", text: "불꽃이 일렁이며, 누군가의 모습이 드러난다." },
      { name: "노아", text: "드디어, 긴 여정의 끝에 도달하셨군요." },
      { name: "노아", text: "이제는 승리의 여명을 불러올 차례입니다." },
      { name: "노아", text: "뭇별을 넘어, 당신의 진정한 미래로 나아가세요." },
    ],
    imageSrc: "/images/gallery/ku-stage5-cutscene-reveal.png",
    caption: "승리의 여신 노아가 당신을 주시한다.",
  },
  yu: {
    lines: [
      { name: "나", text: "푸른 파도가 주변을 휩쓸며, 누군가의 모습이 드러난다." },
      { name: "연", text: "믿고있었어, 여행자. 드디어 완성시켰구나." },
      { name: "연", text: "여명의 빛을 가져올 영웅은.. 바로 너였던거야." },
      { name: "연", text: "이제 새로운 미래를 개척할 시간이야. 자, 모두에게 알려주자고. 너의 '완성작'을!" },
    ],
    imageSrc: "/images/gallery/yu-stage5-cutscene-reveal.png",
    caption: "승리의 여신 연이 당신을 주시한다.",
  },
};

type Phase = "lines" | "flash" | "image";

/**
 * 검이 5단계에 처음 도달하는 순간(또는 이미 5단계인데 아직 못 본 유저의 재접속 시) 뜨는 전용 컷씬.
 * 대사 → 화이트 플래시 → 최종 일러스트 전체화면 → 5초 뒤 자동 종료.
 */
export default function EvolveCutscene({ team, onDone }: { team: TeamId; onDone: () => void }) {
  const data = EVOLVE_CUTSCENES[team];
  const [phase, setPhase] = useState<Phase>("lines");
  const [line, setLine] = useState(0);

  // 부모(GameScreen)가 200ms마다 리렌더되며 onDone을 매번 새로 넘기므로, 의존성에 넣으면
  // 타이머가 계속 리셋되어 절대 안 끝난다 — ref로 최신 값만 참조하고 phase에만 반응한다.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (phase !== "flash") return;
    const t = setTimeout(() => setPhase("image"), 220);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "image") return;
    const t = setTimeout(() => onDoneRef.current(), 5000);
    return () => clearTimeout(t);
  }, [phase]);

  const advance = () => {
    if (phase !== "lines") return;
    if (line >= data.lines.length - 1) {
      setPhase("flash");
      return;
    }
    setLine((l) => l + 1);
  };

  return (
    <div className="evolve-cutscene" onClick={advance}>
      {phase !== "image" && (
        <button
          className="tutorial-skip"
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
        >
          건너뛰기
        </button>
      )}

      {phase === "lines" && (
        <div className="tutorial-dialogue">
          <p className="tutorial-name">{data.lines[line].name}</p>
          <p className="tutorial-line">{data.lines[line].text}</p>
          <p className="tutorial-next-hint">탭하여 계속</p>
        </div>
      )}

      {phase === "flash" && <div className="cutscene-flash" />}

      {phase === "image" && (
        <div className="cutscene-image-wrap">
          <img className="cutscene-image" src={data.imageSrc} alt="" />
          <div className="cutscene-banner">5단계 도감의 이야기가 해금되었습니다</div>
          <div className="cutscene-caption">{data.caption}</div>
        </div>
      )}
    </div>
  );
}
