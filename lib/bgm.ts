"use client";

/**
 * 배경음악 두 계통을 관리한다.
 *   1. 첫 화면(팀 선택) 전용 브금 — 이 화면에서만 재생, 나가면 완전히 정지.
 *   2. 게임 화면 브금 — 진화 단계 그룹(0~1 / 2~3 / 4)에 따라 트랙만 교체하고,
 *      같은 <audio> 엘리먼트를 계속 재사용한다(새로 만들면 자동재생이 막히기 쉬움).
 *
 * 브라우저 자동재생 정책 때문에 play()가 막히면 첫 터치에서 한 번 더 시도한다.
 * 실제 재생 볼륨은 각 트랙의 기준 레벨에 lib/settings.ts의 유저별 bgmVolume × masterVolume(0~1)을 곱한 값이다.
 * iOS의 `el.volume` 무시 문제 때문에 GainNode로 조절한다(lib/audioContext.ts 참고) — GainNode를
 * 못 만드는 환경에서만 `el.volume`으로 폴백한다.
 *
 * ⚠️ 음소거도 같은 이유로 `el.muted` 대신 게인을 0으로 낮추는 방식으로 한다 — 한 번
 * `createMediaElementSource()`로 WebAudio 그래프에 연결된 엘리먼트는 `el.muted`를 바꿔도
 * 그래프로 들어가는 소리 자체는 그대로라 음소거가 안 먹히거나(특히 iOS) 씹히는 경우가 있었다.
 */

import { attachGain, resumeAudioContext } from "./audioContext";
import { getEffectiveBgmVolume } from "./settings";

const TITLE_BASE_VOLUME = 0.5;
const GAMEPLAY_BASE_VOLUME = 0.45;

function retryOnFirstTouch(el: HTMLAudioElement) {
  const retry = () => {
    resumeAudioContext();
    el.play().catch(() => {});
    window.removeEventListener("pointerdown", retry);
  };
  window.addEventListener("pointerdown", retry, { once: true });
}

function setGain(el: HTMLAudioElement, gain: GainNode | null, value: number) {
  if (gain) gain.gain.value = value;
  else el.volume = value; // GainNode를 못 만드는 아주 오래된 브라우저용 폴백
}

/** 음소거 상태를 실제 게인 값으로 환산한다 — muted면 0, 아니면 기준 볼륨 그대로. */
function gainFor(base: number, muted: boolean): number {
  return muted ? 0 : base * getEffectiveBgmVolume();
}

// ---------- 첫 화면 브금 ----------

let titleEl: HTMLAudioElement | null = null;
let titleGain: GainNode | null = null;
let titleMuted = false;

function ensureTitleEl(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!titleEl) {
    titleEl = new Audio("/audio/bgm-title/bgm-title-select.mp3");
    titleEl.loop = true;
    titleGain = attachGain(titleEl);
    setGain(titleEl, titleGain, gainFor(TITLE_BASE_VOLUME, titleMuted));
  }
  return titleEl;
}

export function setTitleBgmMuted(muted: boolean) {
  titleMuted = muted;
  if (titleEl) setGain(titleEl, titleGain, gainFor(TITLE_BASE_VOLUME, muted));
}

export function playTitleBgm() {
  const el = ensureTitleEl();
  if (!el) return;
  resumeAudioContext();
  el.play().catch(() => retryOnFirstTouch(el));
}

export function stopTitleBgm() {
  if (!titleEl) return;
  titleEl.pause();
  titleEl.currentTime = 0;
}

// ---------- 게임 화면 브금 ----------

export type BgmGroup = 0 | 1 | 2;

const GROUP_SUFFIX: Record<BgmGroup, string> = {
  0: "stage0-1",
  1: "stage2-3",
  2: "stage4",
};

/** 진화 단계(0~4)를 브금 그룹으로 묶는다. 단계별 배경 이미지와 동일한 그룹핑. */
export function gameplayGroupOf(stage: number): BgmGroup {
  if (stage <= 1) return 0;
  if (stage <= 3) return 1;
  return 2;
}

/** 파일명 접미사 — 배경 이미지(`bg-{team}-{group}.webp`)에도 그대로 쓰인다. */
export function bgmGroupSuffix(group: BgmGroup): string {
  return GROUP_SUFFIX[group];
}

let gameplayEl: HTMLAudioElement | null = null;
let gameplayGain: GainNode | null = null;
let gameplayMuted = false;

function ensureGameplayEl(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!gameplayEl) {
    gameplayEl = new Audio();
    gameplayEl.loop = true;
    gameplayGain = attachGain(gameplayEl);
    setGain(gameplayEl, gameplayGain, gainFor(GAMEPLAY_BASE_VOLUME, gameplayMuted));
  }
  return gameplayEl;
}

export function setGameplayBgmMuted(muted: boolean) {
  gameplayMuted = muted;
  if (gameplayEl) setGain(gameplayEl, gameplayGain, gainFor(GAMEPLAY_BASE_VOLUME, muted));
}

/** team·group 조합이 바뀔 때만 src를 교체한다. */
export function playGameplayBgm(team: "ku" | "yu", group: BgmGroup) {
  const el = ensureGameplayEl();
  if (!el) return;
  const src = `/audio/bgm-gameplay/bgm-${team}-${GROUP_SUFFIX[group]}.mp3`;
  if (el.src !== new URL(src, window.location.href).href) {
    el.src = src;
  }
  resumeAudioContext();
  el.play().catch(() => retryOnFirstTouch(el));
}

export function stopGameplayBgm() {
  if (!gameplayEl) return;
  gameplayEl.pause();
  gameplayEl.currentTime = 0;
}

/** 설정 시트에서 bgmVolume/masterVolume 슬라이더를 움직일 때, 지금 재생 중인 트랙에도 바로 반영한다. */
export function applyBgmVolume() {
  if (titleEl) setGain(titleEl, titleGain, gainFor(TITLE_BASE_VOLUME, titleMuted));
  if (gameplayEl) setGain(gameplayEl, gameplayGain, gainFor(GAMEPLAY_BASE_VOLUME, gameplayMuted));
}
