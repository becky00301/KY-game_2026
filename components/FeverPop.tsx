"use client";

import { useEffect, useRef } from "react";
import { TeamId } from "@/lib/game";

const DISPLAY_MS = 2600;

interface Tier {
  src: string;
  text: string;
}

const FEVER_POP: Record<TeamId, { side: "left" | "right"; tier1: Tier; tier2: Tier; tier3: Tier }> = {
  ku: {
    side: "right",
    tier1: { src: "/images/fever-pop/ku-tier1-normal.webp", text: "지금이, 여명의 순간입니다!" },
    tier2: { src: "/images/fever-pop/ku-tier2-stage4.webp", text: "지금이, 여명의 순간입니다!" },
    tier3: { src: "/images/fever-pop/ku-tier3-stage5.webp", text: "여명의 빛이, 늘 당신과 함께하길.." },
  },
  yu: {
    side: "left",
    tier1: { src: "/images/fever-pop/yu-tier1-normal.webp", text: "폭주 시스템이 가동되었다!" },
    tier2: { src: "/images/fever-pop/yu-tier2-stage4.webp", text: "폭주 시스템이 가동되었다!" },
    tier3: { src: "/images/fever-pop/yu-tier3-stage5.webp", text: "대단하군. 폭주 시스템을 제어할 줄이야." },
  },
};

/** 검의 현재 단계(0-based)에 따라 피버 팝업의 그림·대사가 3단계로 달라진다. */
function pickTier(stage: number): "tier1" | "tier2" | "tier3" {
  if (stage >= 4) return "tier3"; // 5단계
  if (stage >= 3) return "tier2"; // 4단계
  return "tier1"; // 1~3단계
}

/** 피버 시작 순간 화면 하단 구석에서 튀어나오는 캐릭터 팝업. 2.6초 후 스스로 사라진다. */
export default function FeverPop({
  team,
  stage,
  onDone,
}: {
  team: TeamId;
  stage: number;
  onDone: () => void;
}) {
  const data = FEVER_POP[team];
  const tierKey = pickTier(stage);
  const tier = data[tierKey];
  const sizeClass = tierKey === "tier2" ? "fever-pop-big" : tierKey === "tier3" ? "fever-pop-biggest" : "";

  // CSS의 feverPopFade(2.6s)에 맞춘 타이머로 닫는다 — onAnimationEnd는 자식(fever-pop-img)의
  // 진입 애니메이션이 먼저 끝나며 버블링되어 너무 일찍 닫히는 문제가 있어 쓰지 않는다.
  // 부모(GameScreen)가 200ms마다 리렌더되며 onDone을 매번 새로 넘기므로, 의존성에 넣으면
  // 타이머가 계속 리셋되어 절대 안 끝난다 — ref로 최신 값만 참조하고 마운트 시 한 번만 건다.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), DISPLAY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`fever-pop side-${data.side} ${sizeClass}`} aria-hidden="true">
      <div className="fever-pop-bubble">{tier.text}</div>
      <img className="fever-pop-img" src={tier.src} alt="" />
    </div>
  );
}
