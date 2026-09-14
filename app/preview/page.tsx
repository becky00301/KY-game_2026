"use client";

import Sword from "@/components/Sword";
import SwordFx, { SWORD_FX_START_STAGE } from "@/components/SwordFx";
import { SWORD_STAGE_SCALE } from "@/lib/engine";
import { TEAMS, TeamId } from "@/lib/game";

/** 개발용 단계 갤러리 — 칼 5단계 외형과 3단계부터 붙는 검 주변 이펙트를 한눈에 확인한다. */
export default function PreviewPage() {
  return (
    <div style={{ padding: 16, background: "#0b0710", minHeight: "100dvh" }}>
      {(["ku", "yu"] as TeamId[]).map((id) => {
        const t = TEAMS[id];
        return (
          <section key={id} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, marginBottom: 10, color: t.colors.accent }}>{t.name}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {t.stages.map((name, i) => (
                <div
                  key={name}
                  style={{
                    background: `linear-gradient(160deg, ${t.colors.bgFrom}, ${t.colors.bgTo})`,
                    borderRadius: 12,
                    padding: 6,
                    textAlign: "center",
                  }}
                >
                  <Sword stage={i} theme={t} fever={false} />
                  <p style={{ fontSize: 10, marginTop: 2 }}>
                    {i + 1}. {name}
                  </p>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: 13, margin: "16px 0 8px", color: "#bbb" }}>
              검 주변 이펙트 — 실제 크기 ({SWORD_FX_START_STAGE + 1}단계부터)
            </h3>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
              {t.stages.map((name, i) =>
                i < SWORD_FX_START_STAGE - 1 ? null : (
                  <div
                    key={name}
                    style={{
                      flex: "none",
                      background: `linear-gradient(170deg, ${t.colors.bgFrom}, ${t.colors.bgTo} 60%, #05020a)`,
                      borderRadius: 14,
                      padding: "18px 10px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div className="sword-hit">
                      <SwordFx stage={i} team={id} />
                      <Sword stage={i} theme={t} fever={false} scale={SWORD_STAGE_SCALE[i] ?? 1} />
                    </div>
                    <p style={{ fontSize: 12, marginTop: 6 }}>
                      {i + 1}단계{i < SWORD_FX_START_STAGE ? " (이펙트 없음)" : ""}
                    </p>
                  </div>
                )
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
