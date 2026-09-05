"use client";

/** 볼륨 등 유저별 영구 설정. 값은 0~1, 이 기기의 localStorage에 저장한다. */

const TAP_VOLUME_KEY = "kyg.settings.tapVolume";
const BGM_VOLUME_KEY = "kyg.settings.bgmVolume";

function readVolume(key: string): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(key);
  if (raw == null) return 1;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

function writeVolume(key: string, value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* 사파리 프라이빗 모드 등 */
  }
}

let tapVolume: number | null = null;
let bgmVolume: number | null = null;

/** 터치 사운드류(타격음·카드 해금음·피버 시작음) 공용 볼륨 */
export function getTapVolume(): number {
  if (tapVolume === null) tapVolume = readVolume(TAP_VOLUME_KEY);
  return tapVolume;
}

export function setTapVolume(value: number) {
  tapVolume = Math.min(1, Math.max(0, value));
  writeVolume(TAP_VOLUME_KEY, tapVolume);
}

/** 타이틀·게임 화면 브금 공용 볼륨 */
export function getBgmVolume(): number {
  if (bgmVolume === null) bgmVolume = readVolume(BGM_VOLUME_KEY);
  return bgmVolume;
}

export function setBgmVolume(value: number) {
  bgmVolume = Math.min(1, Math.max(0, value));
  writeVolume(BGM_VOLUME_KEY, bgmVolume);
}
