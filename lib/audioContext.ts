"use client";

/**
 * 공용 WebAudio 컨텍스트.
 *
 * iOS Safari는 `<audio>`/`<video>` 엘리먼트의 `volume` 속성 대입을 그냥 무시한다(하드웨어
 * 볼륨 버튼으로만 조절하게 하려는 의도적 제약). 그래서 환경설정의 볼륨 슬라이더가 iPhone에서는
 * 아예 반영이 안 되는 것처럼 보이는 문제가 있었다.
 *
 * 해결: 오디오 엘리먼트를 WebAudio 그래프(MediaElementSource → GainNode → destination)에
 * 연결하고, 실제 음량 조절은 `el.volume` 대신 `gainNode.gain.value`로 한다. GainNode 기반
 * 음량 조절은 iOS에서도 정상 동작한다.
 */

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** 모바일 자동재생 정책 때문에 첫 사용자 입력에서 한 번 깨워줘야 한다 (iOS는 특히 엄격). */
export function resumeAudioContext() {
  const c = getAudioContext();
  if (c && c.state === "suspended") void c.resume();
}

/**
 * 오디오 엘리먼트를 GainNode에 연결한다. 한 엘리먼트당 한 번만 호출할 수 있다
 * (WebAudio 스펙상 같은 엘리먼트로 MediaElementSource를 두 번 만들면 예외가 난다).
 * AudioContext를 못 만드는 아주 오래된 브라우저에서는 null을 돌려주고, 호출부가
 * `el.volume` 직접 대입으로 폴백하면 된다.
 */
export function attachGain(el: HTMLAudioElement): GainNode | null {
  const c = getAudioContext();
  if (!c) return null;
  try {
    const source = c.createMediaElementSource(el);
    const gain = c.createGain();
    source.connect(gain).connect(c.destination);
    return gain;
  } catch {
    // 이미 연결된 엘리먼트 등 — 폴백하도록 null 반환
    return null;
  }
}
