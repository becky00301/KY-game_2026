"use client";

import { useId } from "react";
import { TeamTheme } from "@/lib/game";

interface Props {
  stage: number; // 0 ~ 6
  theme: TeamTheme;
  fever: boolean;
}

/**
 * 단계가 오를수록 칼날이 길어지고, 날개형 가드·보석·오라가 붙는다.
 * 이미지 에셋 없이 SVG만으로 성장감을 표현.
 */
export default function Sword({ stage, theme, fever }: Props) {
  const c = theme.colors;
  const s = Math.min(stage, 6);

  // 한 페이지에 칼이 여러 개 있어도 defs가 섞이지 않도록 id를 인스턴스마다 분리
  // useId는 React 버전에 따라 ":r0:" · "«r0»" 등을 돌려주므로 url(#...)에 쓸 수 있게 정리한다
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = {
    blade: `blade-${uid}`,
    bladeHot: `bladeHot-${uid}`,
    grip: `grip-${uid}`,
    gold: `gold-${uid}`,
    glow: `softGlow-${uid}`,
  };

  const bladeLen = 150 + s * 14; // 칼날 길이
  const bladeWidth = 20 + s * 2.4;
  const tipY = 200 - bladeLen;
  const guardWidth = 44 + s * 9;
  const gems = Math.min(s, 4);
  const auraRings = s >= 3 ? s - 2 : 0;
  const glowStrength = 1 + s * 0.7 + (fever ? 3 : 0);

  return (
    <svg viewBox="0 0 200 320" className="sword" aria-hidden="true">
      <defs>
        <linearGradient id={ids.blade} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5a6270" />
          <stop offset="35%" stopColor="#eef2f7" />
          <stop offset="52%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#c3ccd8" />
          <stop offset="100%" stopColor="#464d59" />
        </linearGradient>
        <linearGradient id={ids.bladeHot} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={c.primary} stopOpacity={s >= 3 ? 0.85 : 0.25} />
          <stop offset="60%" stopColor={c.glow} stopOpacity={s >= 5 ? 0.7 : 0.2} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={ids.grip} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c.primaryDeep} />
          <stop offset="50%" stopColor={c.primary} />
          <stop offset="100%" stopColor={c.primaryDeep} />
        </linearGradient>
        <linearGradient id={ids.gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.accent} />
          <stop offset="50%" stopColor="#fff3cf" />
          <stop offset="100%" stopColor={c.accent} />
        </linearGradient>
        <filter id={ids.glow} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={2 + glowStrength} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 오라 링 */}
      {Array.from({ length: auraRings }).map((_, i) => (
        <ellipse
          key={i}
          cx="100"
          cy="215"
          rx={48 + i * 22}
          ry={14 + i * 5}
          fill="none"
          stroke={i % 2 === 0 ? c.glow : c.accent}
          strokeWidth="1.6"
          opacity={0.5 - i * 0.09}
          className="aura"
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}

      <g filter={`url(#${ids.glow})`}>
        {/* 칼날 */}
        <path
          d={`M100 ${tipY} L${100 + bladeWidth / 2} ${tipY + 26} L${100 + bladeWidth / 2} 196 L${
            100 - bladeWidth / 2
          } 196 L${100 - bladeWidth / 2} ${tipY + 26} Z`}
          fill={`url(#${ids.blade})`}
        />
        <path
          d={`M100 ${tipY} L${100 + bladeWidth / 2} ${tipY + 26} L${100 + bladeWidth / 2} 196 L${
            100 - bladeWidth / 2
          } 196 L${100 - bladeWidth / 2} ${tipY + 26} Z`}
          fill={`url(#${ids.bladeHot})`}
        />
        {/* 혈조 */}
        <rect x="98.4" y={tipY + 22} width="3.2" height={196 - tipY - 26} fill={c.primaryDeep} opacity="0.55" />

        {/* 칼날 문양 */}
        {s >= 2 &&
          Array.from({ length: Math.min(s, 5) }).map((_, i) => (
            <circle
              key={i}
              cx="100"
              cy={180 - i * (bladeLen / 7)}
              r={2.2}
              fill={c.accent}
              opacity="0.9"
            />
          ))}

        {/* 가드 */}
        <path
          d={`M${100 - guardWidth / 2} 206
              Q100 ${s >= 4 ? 184 : 194} ${100 + guardWidth / 2} 206
              L${100 + guardWidth / 2 - 6} 218
              Q100 208 ${100 - guardWidth / 2 + 6} 218 Z`}
          fill={`url(#${ids.gold})`}
          stroke={c.primaryDeep}
          strokeWidth="1.2"
        />

        {/* 가드 보석 */}
        {Array.from({ length: gems }).map((_, i) => {
          const spread = guardWidth / 2 - 12;
          const x = gems === 1 ? 100 : 100 - spread + (i * (spread * 2)) / (gems - 1);
          return <circle key={i} cx={x} cy="209" r="3.4" fill={c.glow} opacity="0.95" />;
        })}

        {/* 손잡이 */}
        <rect x="92" y="218" width="16" height="62" rx="7" fill={`url(#${ids.grip})`} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="90" y={226 + i * 14} width="20" height="4" rx="2" fill={c.accent} opacity="0.75" />
        ))}

        {/* 폼멜 */}
        <circle cx="100" cy="288" r="12" fill={`url(#${ids.gold})`} stroke={c.primaryDeep} strokeWidth="1.2" />
        <circle cx="100" cy="288" r="5" fill={c.primary} />
      </g>

      {/* 최종 단계 광휘 */}
      {s >= 6 && (
        <g className="halo">
          {Array.from({ length: 8 }).map((_, i) => (
            <rect
              key={i}
              x="99"
              y="120"
              width="2"
              height="34"
              fill={c.accent}
              opacity="0.55"
              transform={`rotate(${i * 45} 100 200)`}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
