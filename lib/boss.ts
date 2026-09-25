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

/** 전투 방법(BossGuide)을 이미 봤는지 — 서휘령 도감의 "guide" 카드 해금 여부. */
export function hasSeenBossGuide(team: TeamId): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(`bossGuideSeen:${team}`) === "1"; }
  catch { return false; }
}

export function claimBossGuide(team: TeamId): boolean {
  if (hasSeenBossGuide(team)) return false;
  try { window.localStorage.setItem(`bossGuideSeen:${team}`, "1"); } catch { /* session fallback */ }
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
// image가 있으면 앞면에 일러스트를, lore가 있으면 뒷면에 칼 도감(노아·연)과 같은 스크롤 박스를 보여준다.
export interface BossCard {
  id: "intro" | "guide" | "victory";
  title: string;
  caption?: string;
  lore?: string;
  image?: string;
}

export const BOSS_CARDS: BossCard[] = [
  {
    id: "intro",
    title: "검귀 서휘령",
    image: "/images/boss/boss-card-intro.webp",
    lore: "완성되지 못하고 사라져버린 검술들. 그 뒤에는 항상 서휘령이라는 검귀가 존재했다. 잘못된 검술의 실험으로 인한 누이의 억울한 죽음은 그를 몇백년간 천지를 떠도는 악귀로 만들어버렸다. 그의 목표는 단 하나. 추악하고 미숙한 검술들을 모두 파괴하고 심판과 전쟁따위 없는 무(無)의 세계를 만드는 것. 그에게는 사용하는 검술 따위 존재하지 않는다. 수많은 세월동안 죽여온 이들의 혼령이 담겨있는 '도깨비의 검' 이 스스로 참격을 만들어 낼 뿐이다.",
  },
  { id: "guide", title: "???", caption: "이야기는 아직 준비 중입니다." },
  { id: "victory", title: "완벽한 패배", caption: "서휘령은 마지막 순간, 누이 서여한의 진심을 전해받고 눈을 감았다." },
];

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
 * 조력자(서여한)가 들려주는 전투 설명 — 입장맵의 "전투 방법 보기" 버튼으로 언제든 다시
 * 볼 수 있다(자동으로 뜨지는 않는다). 정체는 이름을 밝히는 대사 전까지 "???"로 둔다.
 * 문구를 바꾸려면 여기만 고치면 된다. (규칙 수치는 lib/bossBattle.ts)
 */
/** demo: 대사와 함께 보여줄 작은 예시 — "zones"는 빨강·노랑 예고, "vanish"는 색이 사라진 뒤 약점을 베는 모습 */
export const BOSS_GUIDE_LINES: { name: string; text: string; portrait?: boolean; demo?: "zones" | "vanish" }[] = [
  { name: "나", text: "서휘령에게 다가가려는 순간, 누군가의 목소리가 들려왔다." },
  { name: "???", text: "잠시만요, 여행자님. 잠시.. 제 이야기를 들어주실 수 있나요?" },
  { name: "서여한", text: "제 이름은 서여한. 서휘령의 죽은 누이랍니다.." },
  { name: "서여한", text: "잠깐이지만 혼령의 몸을 빌려 나타날 수 있었어요. 당신에게 휘령이를 막을 방법을 전달해드리겠습니다.", portrait: true },
  { name: "서여한", text: "휘령이가 공격하는 지점은 '붉은 빛'으로 나타나요. 당신이 안전하게 공격할 수 있는 지점은, 제 마력으로 비춰드릴게요.", portrait: true, demo: "zones" },
  { name: "서여한", text: "붉은 빛이 사라지면, 공격이 시작될거에요. 빨간 빛이 비추던 곳은 피하고, 저의 빛이 있던 곳을 기억해 뒀다가 베어주세요.", portrait: true, demo: "vanish" },
  { name: "서여한", text: "그리고.. 저의 마력을 빌려드리겠습니다. 휘령이가 기를 모을 때, 이 마력으로 막아낼 수 있을거에요.", portrait: true },
  { name: "서여한", text: "갑작스럽게 전달드려 죄송합니다. 하지만..하지만, 어쩔 수 없었어요. 당신에게 마지막 희망을 걸어보겠어요.", portrait: true },
  { name: "서여한", text: "제발..저의 동생을 막아주세요!", portrait: true },
];
