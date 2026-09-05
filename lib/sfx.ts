"use client";

/**
 * 짧은 효과음 재생.
 *
 * 터치음은 실제 사운드 파일 중 하나를 매번 무작위로 골라 재생한다 — 겹쳐 눌러도 안 끊기게
 * 매번 새 Audio 인스턴스를 만든다. 카드 해금·피버 시작음은 전용 파일을 쓴다.
 * 볼륨은 전부 lib/settings.ts의 tapVolume(터치 사운드류 공용) × masterVolume 설정을 따른다.
 */

import { TeamId } from "./game";
import { getEffectiveTapVolume } from "./settings";

let enabled = true;

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

export function isSfxEnabled() {
  return enabled;
}

/** 모바일 자동재생 정책 때문에 첫 사용자 입력에서 한 번 깨워준다. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  const a = new Audio();
  a.volume = 0;
  a.play().catch(() => {});
}

function playFile(src: string) {
  if (!enabled || typeof window === "undefined") return;
  const audio = new Audio(src);
  audio.volume = getEffectiveTapVolume();
  audio.play().catch(() => {});
}

const TAP_SOUNDS = ["/audio/tap/tap-sound-1.mp3", "/audio/tap/tap-sound-2.mp3", "/audio/tap/tap-sound-3.mp3"];

const STAGE3_SPECIAL_SOUND: Record<TeamId, string> = {
  ku: "/audio/tap/stage3-special-ku.mp3",
  yu: "/audio/tap/stage3-special-yu.mp3",
};

/** 가중치 기반 무작위 선택. 3단계(stage index >= 2) 이후엔 팀 전용음이 살짝 더 잘 뽑힌다. */
function pickTapSound(team: TeamId, stage: number): string {
  const pool: { sound: string; weight: number }[] = TAP_SOUNDS.map((s) => ({ sound: s, weight: 1 }));
  if (stage >= 2) pool.push({ sound: STAGE3_SPECIAL_SOUND[team], weight: 1.4 });

  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * total;
  for (const p of pool) {
    if (roll < p.weight) return p.sound;
    roll -= p.weight;
  }
  return pool[pool.length - 1].sound;
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
