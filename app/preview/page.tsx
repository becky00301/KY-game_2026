"use client";

import Sword from "@/components/Sword";
import { TEAMS, TeamId } from "@/lib/game";

/** 개발용 단계 갤러리 — 칼 7단계 외형을 한눈에 확인한다. */
export default function PreviewPage() {
  return (
    <div style={{ padding: 16, background: "#0b0710", minHeight: "100dvh" }}>
      {(["ku", "yu"] as TeamId[]).map((id) => {
        const t = TEAMS[id];
        return (
          <section key={id} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, marginBottom: 10, color: t.colors.accent }}>{t.name}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
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
                    {i}. {name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
