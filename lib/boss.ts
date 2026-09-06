import { TeamId } from "./game";

/** This browser's story progress is independent of the shared sword database. */
const seenThisSession = new Set<TeamId>();
export function hasSeenBossIntro(team: TeamId): boolean {
  if (seenThisSession.has(team)) return true;
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(`bossIntroSeen:${team}`) === "1"; }
  catch { return false; }
}

/** Synchronous claim prevents duplicate cutscenes even when storage is unavailable. */
export function claimBossIntro(team: TeamId): boolean {
  if (hasSeenBossIntro(team)) return false;
  seenThisSession.add(team);
  try { window.localStorage.setItem(`bossIntroSeen:${team}`, "1"); } catch { /* session fallback */ }
  return true;
}

export function crossedBossThreshold(previousStars: number, stars: number, atMaxStage: boolean): boolean {
  return atMaxStage && previousStars < 1 && stars >= 1;
}

export const BOSS_INTRO = {
  bgmSrc: "/audio/boss-intro-bgm.mp3",
  portraitSrc: "/images/boss/boss-portrait.webp",
  revealBgSrc: "/images/boss/boss-reveal-bg.webp",
  revealCaption: "몰락한 검귀, 서휘령이 당신을 주시합니다.",
  lines: [
    { name: "나", text: "주변에서 스산한 바람이 느껴진다. 분위기가 심상치않다.", portrait: false },
    { name: "???", text: "훌륭한 검술이야. 그 어떤 악도 처단할 수 있는, 서광을 불러오는 검..", portrait: false },
    { name: "???", text: "너는 이 검술로 어떤 여정에 오를거지? 악인을 무찌르고, 이름을 날리거나.. 검술을 더 갈고닦아, 너만의 검법을 완성시킬 수도 있겠지.", portrait: false },
    { name: "나", text: "너는 누구지?", portrait: false },
    { name: "서휘령", text: "내 이름은 서휘령. 세간에서는 나를, '사냥꾼'이라고 부르더군.", portrait: true },
    { name: "서휘령", text: "네놈들의 검술은 위험하다. 그렇기에, 지금 이 자리에서 처단하겠다.", portrait: true },
    { name: "서휘령", text: "내 누이를 앗아간 검.. 증명해보거라. 과연, 너의 실력은 그만큼 대단하다고 할 수 있을까?", portrait: true },
  ],
};

// Add future story cards here; defeat/unlock conditions can be introduced with combat.
export const BOSS_CARDS = [
  { id: "intro", title: "???", caption: "이야기는 아직 준비 중입니다." },
  { id: "victory", title: "???", caption: "이야기는 아직 준비 중입니다." },
] as const;
