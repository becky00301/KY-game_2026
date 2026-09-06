"use client";

/**
 * 짧은 효과음 재생.
 *
 * 터치음은 실제 사운드 파일 중 하나를 매번 무작위로 골라 재생한다. 겹쳐 눌러도 안 끊기게
 * 여러 개를 돌려쓰는 재생 채널 풀(pool)을 쓴다 — 매 터치마다 `new Audio()` +
 * `createMediaElementSource()`를 새로 만들면(WebAudio 그래프 생성 비용이 꽤 큼) 빠르게
 * 연타할 때 렉이 심하게 걸렸다. 카드 해금·피버 시작음도 같은 풀을 공유한다.
 * 볼륨은 전부 lib/settings.ts의 tapVolume(터치 사운드류 공용) × masterVolume 설정을 따른다.
 * iOS는 `<audio>.volume` 대입을 무시하므로 GainNode로 조절한다(lib/audioContext.ts 참고).
 */

import { TeamId } from "./game";
import { attachGain, resumeAudioContext } from "./audioContext";
import { getEffectiveTapVolume } from "./settings";

let enabled = true;

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

export function isSfxEnabled() {
  return enabled;
}

let unlocked = false;

/** 모바일 자동재생 정책 때문에 첫 사용자 입력에서 한 번 깨워준다. 실제 probe 재생은 한 번만 한다. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  resumeAudioContext();
  if (unlocked) return;
  unlocked = true;
  const a = new Audio();
  a.volume = 0;
  a.play().catch(() => {});
}

interface PoolSlot {
  el: HTMLAudioElement;
  gain: GainNode | null;
}

/** 동시에 겹칠 수 있는 터치음 채널 수. 빠른 연타에서도 살짝 여유 있게 잡는다. */
const POOL_SIZE = 10;
const pool: PoolSlot[] = [];
let poolCursor = 0;

/** 풀에서 재생 채널을 하나 돌려쓴다 — 처음 채워질 때만 새 Audio/GainNode를 만든다. */
function nextPoolSlot(): PoolSlot | null {
  if (typeof window === "undefined") return null;
  if (pool.length < POOL_SIZE) {
    const el = new Audio();
    const gain = attachGain(el);
    pool.push({ el, gain });
  }
  const slot = pool[poolCursor];
  poolCursor = (poolCursor + 1) % POOL_SIZE;
  return slot;
}

function playFile(src: string) {
  if (!enabled || typeof window === "undefined") return;
  const slot = nextPoolSlot();
  if (!slot) return;
  const { el, gain } = slot;
  el.src = src;
  try {
    el.currentTime = 0;
  } catch {
    /* 아직 메타데이터를 못 읽었으면 무시해도 된다 — 어차피 새 src라 0부터 재생된다 */
  }
  if (gain) gain.gain.value = getEffectiveTapVolume();
  else el.volume = getEffectiveTapVolume();
  resumeAudioContext();
  el.play().catch(() => {});
}

const TAP_SOUNDS = ["/audio/tap/tap-sound-1.mp3", "/audio/tap/tap-sound-2.mp3", "/audio/tap/tap-sound-3.mp3"];

const STAGE3_SPECIAL_SOUND: Record<TeamId, string> = {
  ku: "/audio/tap/stage3-special-ku.mp3",
  yu: "/audio/tap/stage3-special-yu.mp3",
};

/** 가중치 기반 무작위 선택. 3단계(stage index >= 2) 이후엔 팀 전용음이 살짝 더 잘 뽑힌다. */
function pickTapSound(team: TeamId, stage: number): string {
  const candidates: { sound: string; weight: number }[] = TAP_SOUNDS.map((s) => ({ sound: s, weight: 1 }));
  if (stage >= 2) candidates.push({ sound: STAGE3_SPECIAL_SOUND[team], weight: 1.4 });

  const total = candidates.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * total;
  for (const p of candidates) {
    if (roll < p.weight) return p.sound;
    roll -= p.weight;
  }
  return candidates[candidates.length - 1].sound;
}

/** 칼 두드리는 소리. */
export function playHit(team: TeamId, stage: number) {
  playFile(pickTapSound(team, stage));
}

/** 도감 카드(진화/후일담) 해금 팝업 사운드. */
export function playCardRevealSound() {
  playFile("/audio/misc/card-reveal-sound.mp3");
}

/** 응원 열기(피버) 시작 사운드. */
export function playFeverStartSound() {
  playFile("/audio/misc/fever-start-sound.mp3");
}
