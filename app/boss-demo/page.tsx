"use client";

import { useEffect, useState } from "react";
import BossBattle from "@/components/BossBattle";
import { BossGallery, BossMap } from "@/components/BossEncounter";
import SettingsSheet from "@/components/SettingsSheet";
import { startBossBgm, stopBossBgm } from "@/lib/bgm";
import { isSfxEnabled, setSfxEnabled, unlockAudio } from "@/lib/sfx";

type Mode = "map" | "battle" | "done";

/**
 * 친구 테스트 배포용 — 보스전만 따로 떼어낸 링크. 실제 게임(components/BossEncounter,
 * components/BossBattle)을 그대로 재사용하므로 일러스트·타이밍·밸런스가 실제 게임과
 * 완전히 동일하다. 진화 진행도나 팀 선택 없이 곧장 입장맵부터 시작한다.
 */
export default function BossDemoPage() {
  const [mode, setMode] = useState<Mode>("map");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sfxOn, setSfxOn] = useState(true);
  const [debugPhase2, setDebugPhase2] = useState(false);
  const [debugLowHp, setDebugLowHp] = useState(false);
  const [debugEpilogue, setDebugEpilogue] = useState(false);

  // 개발용 지름길 — /boss-demo?debugBoss=2 로 2페이즈 등장 연출부터 바로 확인.
  // ?debugBoss=3 은 거기에 더해 HP를 10%로 시작해서 발악(HP 0%)까지 금방 확인할 수 있다.
  // ?debugBoss=4 는 전투를 건너뛰고 2페이즈 격파 후일담(대화+엔딩 이미지)부터 바로 확인.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("debugBoss");
    if (v === "2" || v === "3" || v === "4") {
      unlockAudio();
      startBossBgm();
      setDebugPhase2(v === "2" || v === "3");
      setDebugLowHp(v === "3");
      setDebugEpilogue(v === "4");
      setMode("battle");
    }
  }, []);

  return (
    <>
      {mode === "map" && (
        <BossMap
          onExit={() => setMode("done")}
          onGallery={() => setGalleryOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          soundOn={sfxOn && isSfxEnabled()}
          onToggleSound={() => {
            const next = !sfxOn;
            setSfxOn(next);
            setSfxEnabled(next);
          }}
          onEnter={() => {
            unlockAudio();
            startBossBgm();
            setMode("battle");
          }}
        />
      )}

      {mode === "battle" && (
        <BossBattle
          debugStartPhase2={debugPhase2}
          debugLowHp={debugLowHp}
          debugStartEpilogue={debugEpilogue}
          onExit={() => {
            stopBossBgm();
            setMode("map");
          }}
        />
      )}

      {mode === "done" && (
        <section className="boss-map-screen boss-theme" aria-label="테스트 종료">
          <div className="boss-map-bg" />
          <div className="boss-map-content">
            <h1 className="boss-map-heading" style={{ color: "#e7fbf6", fontSize: 20, fontWeight: 700 }}>
              테스트해줘서 고마워!
            </h1>
            <p className="boss-map-subtitle">몇 번이든 다시 도전해볼 수 있어. 승패는 저장되지 않아.</p>
          </div>
          <div className="boss-map-actions">
            <button className="boss-map-enter-btn" onClick={() => setMode("map")}>다시 도전하기</button>
          </div>
        </section>
      )}

      {galleryOpen && <BossGallery unlocked={false} onClose={() => setGalleryOpen(false)} />}
      {settingsOpen && (
        <SettingsSheet
          boss
          onClose={() => setSettingsOpen(false)}
          pipSupported={false}
          pipActive={false}
          onTogglePip={() => {}}
        />
      )}
    </>
  );
}
