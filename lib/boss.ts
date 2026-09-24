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

/** 2페이즈(진짜 격파) 후일담을 이미 봤는지 — 서휘령 도감의 "victory" 카드 해금 여부. */
export function hasSeenBossVictory(team: TeamId): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(`bossVictorySeen:${team}`) === "1"; }
  catch { return false; }
}

export function claimBossVictory(team: TeamId): boolean {
  if (hasSeenBossVictory(team)) return false;
  try { window.localStorage.setItem(`bossVictorySeen:${team}`, "1"); } catch { /* session fallback */ }
  return true;
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

/** 2페이즈 진입 시 교체되는 전투 배경·검 일러스트·브금. */
export const BOSS_PHASE2_ASSETS = {
  bgmSrc: "/audio/boss-phase2-bgm.mp3",
  battleBgSrc: "/images/boss-battle/battle-bg-phase2.png",
  swordSrc: "/images/boss/boss-map-sword-phase2.png",
};

// Add future story cards here; defeat/unlock conditions can be introduced with combat.
export const BOSS_CARDS = [
  { id: "intro", title: "???", caption: "이야기는 아직 준비 중입니다." },
  { id: "victory", title: "완벽한 패배", caption: "서휘령은 마지막 순간, 누이 서여한의 진심을 전해받고 눈을 감았다." },
] as const;

/** 2페이즈(진짜 격파) 후 재생되는 후일담 대화. speaker에 따라 초상화가 바뀌거나
 *  (narrator는 초상화 없음) 사라진다. */
export type BossEpilogueSpeaker = "hwiryeong" | "yeohan" | "narrator";
export interface BossEpilogueLine {
  speaker: BossEpilogueSpeaker;
  name: string;
  text: string;
}

export const BOSS_EPILOGUE_PORTRAITS: Record<"hwiryeong" | "yeohan", string> = {
  hwiryeong: "/images/boss-battle/hwiryeong-wounded.png",
  yeohan: "/images/boss-battle/seo-yeohan.png",
};

/** 후일담 마지막 — 화면이 암전된 뒤 4초간 꽉 차게 뜨는 엔딩 일러스트. */
export const BOSS_EPILOGUE_ENDING_IMAGE_SRC = "/images/boss-battle/ending-two-swords.png";
export const BOSS_EPILOGUE_ENDING_IMAGE_MS = 4000;

export const BOSS_EPILOGUE_LINES: BossEpilogueLine[] = [
  { speaker: "hwiryeong", name: "서휘령", text: "....." },
  { speaker: "hwiryeong", name: "서휘령", text: "내가... 내가 졌다. 완벽한 패배야." },
  { speaker: "hwiryeong", name: "서휘령", text: "정말..훌륭한 검술이구나." },
  { speaker: "hwiryeong", name: "서휘령", text: "누님..저는.." },
  { speaker: "yeohan", name: "서여한", text: "... 여행자님, 휘령이에게, 이 말을 전해주시겠어요?" },
  { speaker: "yeohan", name: "서여한", text: "'뭇별의 너머에서, 우린 반드시 만나게 될 거라고..'" },
  { speaker: "narrator", name: "나", text: "(말을 전한다)" },
  { speaker: "hwiryeong", name: "서휘령", text: "..너..너가 어떻게 그걸.." },
  { speaker: "hwiryeong", name: "서휘령", text: "...그래. 맞아.. 어렴풋이 느끼고 있었어. 누님의 힘을.." },
  { speaker: "hwiryeong", name: "서휘령", text: "외면하고 있었다. 이미 너무 많은 목숨을 베어버렸으니까.." },
  { speaker: "hwiryeong", name: "서휘령", text: "그래..정작.. 용서받지 못한 검은, 바로 나였구나." },
  { speaker: "hwiryeong", name: "서휘령", text: "..." },
  { speaker: "narrator", name: "나", text: "(서휘령은 완전히 숨을 거둔 것 같다.)" },
  { speaker: "yeohan", name: "서여한", text: "감사합니다. 여행자님. 드디어.. 모두가 고통의 굴레에서 벗어날 수 있을 거에요." },
  { speaker: "yeohan", name: "서여한", text: "당신은.. 제가 본 그 어떤 검사보다 강하답니다. 부디.. 당신의 여정에 뭇별이 함께하기를." },
  { speaker: "yeohan", name: "서여한", text: "... 휘령이의 영혼은 더럽혀졌기에, 다시는 만날 수 없겠지만.." },
  { speaker: "yeohan", name: "서여한", text: "마지막 인사정도는.. 해주고싶네요." },
];

/**
 * 첫 전투 직전에 조력자가 들려주는 전투 설명. 이름은 후일담 전까지 정체를 숨기려고 "???"로 둔다.
 * 문구를 바꾸려면 여기만 고치면 된다. (규칙 수치는 lib/bossBattle.ts)
 */
/** demo: 대사와 함께 보여줄 작은 예시 — "zones"는 빨강·노랑 예고, "vanish"는 색이 사라진 뒤 약점을 베는 모습 */
export const BOSS_GUIDE_LINES: { name: string; text: string; demo?: "zones" | "vanish" }[] = [
  { name: "???", text: "잠깐만요! 서휘령과 맞서기 전에, 제 이야기를 꼭 들어주세요." },
  { name: "???", text: "화면을 두드리면 서휘령에게 검격을 가할 수 있어요. 쉬지 않고 이어서 두드릴수록 콤보가 쌓여 더 강한 일격이 돼요." },
  { name: "???", text: "그가 공격하기 직전, 제가 잠깐 보여드릴게요. 빨간 빗금은 그의 검이 떨어질 곳, 노란빛은 그의 약점이에요.", demo: "zones" },
  { name: "???", text: "색이 사라지는 순간 공격이 시작돼요. 빨간 빗금이 있던 곳은 누르지 말고, 노란빛이 있던 곳을 기억해 뒀다가 베어주세요!", demo: "vanish" },
  { name: "???", text: "약점을 한 번도 베지 못하면, 그의 공격을 그대로 맞게 돼요. 색이 보일 때 누르는 건 소용없어요. 사라진 뒤에 베어야 해요.", demo: "vanish" },
  { name: "???", text: "화면 전체가 붉게 물들면 어디든 위험해요. 그땐 잠깐 손을 떼주세요." },
  { name: "???", text: "버틸 수 있는 건 다섯 번뿐이에요. 콤보를 50까지 이으면 한 번을 되찾을 수 있어요. 부디.. 그를 멈춰주세요." },
];

/** 전투 설명을 이미 봤는지 — 처음 입장할 때만 자동으로 보여준다(지도 화면에서 다시 볼 수 있음). */
export function hasSeenBossGuide(team: TeamId): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(`bossGuideSeen:${team}`) === "1"; }
  catch { return false; }
}

export function markBossGuideSeen(team: TeamId) {
  try { window.localStorage.setItem(`bossGuideSeen:${team}`, "1"); } catch { /* 저장 불가면 다음에 또 보여준다 */ }
}
