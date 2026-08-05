/**
 * 에셋 없이 WebAudio로 타격음을 합성한다.
 * (음원 저작권 확인 전이라 자체 생성 효과음만 사용)
 */

let ctx: AudioContext | null = null;
let enabled = true;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

export function isSfxEnabled() {
  return enabled;
}

/** 모바일 자동재생 정책 때문에 첫 사용자 입력에서 한 번 깨워준다. */
export function unlockAudio() {
  audio();
}

/** 칼 두드리는 소리. combo가 높을수록 음이 올라간다. */
export function playHit(combo: number, fever: boolean) {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;

  const now = ac.currentTime;
  const pitch = 320 + Math.min(combo, 60) * 6 + (fever ? 180 : 0);

  // 금속성 몸통
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(pitch, now);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.45, now + 0.09);
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.12);

  // 타격 노이즈
  const len = Math.floor(ac.sampleRate * 0.03);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ac.createBufferSource();
  const nGain = ac.createGain();
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  nGain.gain.setValueAtTime(0.09, now);
  nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  noise.buffer = buf;
  noise.connect(hp).connect(nGain).connect(ac.destination);
  noise.start(now);
}

/** 진화 · 응원 열기 발동용 상승음 */
export function playFanfare() {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  [0, 4, 7, 12].forEach((semi, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 330 * Math.pow(2, semi / 12);
    const t = now + i * 0.08;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}
