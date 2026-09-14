"use client";

import { CSSProperties, useMemo } from "react";
import { TeamId } from "@/lib/game";

/**
 * 검 단계 이펙트 — 3단계부터 검 주위에 기운이 피어오른다.
 *
 * 예전에 별 획득 때 링이 터지는 화려한 연출을 넣었다가 "요란하다"는 피드백으로 뺀 적이 있어서
 * (handoff2/SPEC.md 10번), 여기서도 은은하게 시작해 단계마다 한 겹씩만 더한다.
 *   3단계: 검 뒤 빛기둥 + 피어오르는 입자 조금
 *   4단계: 입자 늘림 + 검 밑동을 도는 고리
 *   5단계: 입자 더 늘림 + 반대로 도는 바깥 고리
 *
 * 고대는 따뜻한 불티(둥근 점), 연대는 푸른 데이터 조각(네모 점)으로 팀 느낌을 나눈다.
 * 전부 pointer-events: none 이라 칼 터치를 가로채지 않는다.
 */

/** 이 stage 값(0부터)부터 이펙트가 켜진다. 화면에 보이는 단계로는 3단계. */
export const SWORD_FX_START_STAGE = 2;

/** 단계 등급별 입자 수. index = 등급(0 = 이펙트 없음) */
const MOTES_BY_TIER = [0, 8, 13, 18];

interface Mote {
  left: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  front: boolean;
}

/** 0~1 고정 난수 — 렌더할 때마다 입자 위치가 바뀌지 않도록 인덱스로 정한다. */
/** 서버 렌더와 브라우저의 부동소수점 끝자리가 달라 경고가 나지 않도록 소수 둘째 자리에서 끊는다. */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export default function SwordFx({ stage, team }: { stage: number; team: TeamId }) {
  const tier = Math.max(0, Math.min(3, stage - SWORD_FX_START_STAGE + 1));

  const motes = useMemo<Mote[]>(
    () =>
      Array.from({ length: MOTES_BY_TIER[tier] }, (_, i) => ({
        left: round2(22 + seeded(i, 1) * 56),
        // 음수 지연으로 시작해서, 화면에 들어오자마자 입자가 이미 흩어져 있게 한다.
        delay: round2(-seeded(i, 2) * 7),
        duration: round2(4.4 + seeded(i, 3) * 3.4),
        size: round2(3 + seeded(i, 4) * 3.5),
        drift: round2((seeded(i, 5) - 0.5) * 46),
        front: seeded(i, 6) > 0.55,
      })),
    [tier]
  );

  if (tier === 0) return null;

  const renderMote = (m: Mote, i: number) => (
    <span
      key={i}
      className="sfx-mote"
      style={
        {
          left: `${m.left}%`,
          width: m.size,
          height: m.size,
          animationDelay: `${m.delay}s`,
          animationDuration: `${m.duration}s`,
          "--drift": `${m.drift}px`,
        } as CSSProperties
      }
    />
  );

  return (
    <>
      <span className="sword-fx sword-fx-back" data-team={team} data-tier={tier} aria-hidden="true">
        <span className="sfx-pillar" />
        {tier >= 2 && <span className="sfx-ring" />}
        {tier >= 3 && <span className="sfx-ring sfx-ring--outer" />}
        {motes.filter((m) => !m.front).map(renderMote)}
      </span>
      <span className="sword-fx sword-fx-front" data-team={team} data-tier={tier} aria-hidden="true">
        {motes.filter((m) => m.front).map(renderMote)}
      </span>
    </>
  );
}
