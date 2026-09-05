"use client";

import { useState } from "react";
import { applyBgmVolume } from "@/lib/bgm";
import {
  getBgmVolume,
  getMasterVolume,
  getTapVolume,
  setBgmVolume,
  setMasterVolume,
  setTapVolume,
} from "@/lib/settings";

/** 환경설정 시트 — PIP 모드, 전체/BGM/터치 사운드 볼륨, 부가 링크, 제작자 정보. */
export default function SettingsSheet({
  onClose,
  pipSupported,
  pipActive,
  onTogglePip,
}: {
  onClose: () => void;
  /** Document PIP API 지원 여부 — 데스크톱 크롬·엣지·파이어폭스 최신 버전에서만 true */
  pipSupported: boolean;
  /** 지금 PIP 창이 떠 있는지 */
  pipActive: boolean;
  onTogglePip: () => void;
}) {
  const [master, setMaster] = useState(() => Math.round(getMasterVolume() * 100));
  const [bgm, setBgm] = useState(() => Math.round(getBgmVolume() * 100));
  const [tap, setTap] = useState(() => Math.round(getTapVolume() * 100));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet settings" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />

        <header className="sheet-head">
          <div>
            <p className="sheet-energy-label">환경설정</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        {pipSupported ? (
          <button className="settings-pip-btn" onClick={onTogglePip}>
            {pipActive ? "PIP 모드 끄기" : "PIP 모드로 작게 띄우기"}
          </button>
        ) : (
          <p className="settings-pip-note">
            PIP 모드는 이 브라우저에서 지원되지 않습니다 (데스크톱 크롬·엣지·파이어폭스 최신 버전에서
            사용 가능).
          </p>
        )}

        <div className="settings-row">
          <label className="settings-label" htmlFor="master-volume">
            전체 사운드
          </label>
          <input
            id="master-volume"
            className="settings-slider"
            type="range"
            min={0}
            max={100}
            value={master}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMaster(v);
              setMasterVolume(v / 100);
              applyBgmVolume();
            }}
          />
        </div>

        <div className="settings-row">
          <label className="settings-label" htmlFor="bgm-volume">
            BGM 볼륨
          </label>
          <input
            id="bgm-volume"
            className="settings-slider"
            type="range"
            min={0}
            max={100}
            value={bgm}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBgm(v);
              setBgmVolume(v / 100);
              applyBgmVolume();
            }}
          />
        </div>

        <div className="settings-row">
          <label className="settings-label" htmlFor="tap-volume">
            터치 사운드 볼륨
          </label>
          <input
            id="tap-volume"
            className="settings-slider"
            type="range"
            min={0}
            max={100}
            value={tap}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTap(v);
              setTapVolume(v / 100);
            }}
          />
        </div>

        <a className="settings-link" href="#" onClick={(e) => e.preventDefault()}>
          일러스트 &amp; BGM 다운로드 페이지로 이동
        </a>

        <div className="settings-credit">
          <p className="settings-credit-label">제작자 정보</p>
          <p className="settings-credit-body">추후 업데이트 예정입니다.</p>
        </div>
      </section>
    </div>
  );
}
