# 데모 → 실제 레포 반영 스펙 (2차)

이 문서는 1차 핸드오프(`STAGE_THRESHOLDS` 5단계 축소, 첫 화면 등) **이후**
`ky-game-preview.html` 데모에서 추가로 확정된 변경사항만 정리한 것입니다.
1차 SPEC.md 내용은 이미 반영되었다는 전제로, 여기서는 새로 추가된 것만 다룹니다.

이 폴더 `assets/` 안에 이번에 확정된 이미지·오디오 원본이 전부 들어있습니다
(데모 HTML 안에 base64로 박혀있던 걸 실제 파일로 꺼낸 것). Next.js에서는 `public/` 아래에 두고
`<Image src="/..." />` / `<audio src="/...">` 로 참조하면 됩니다.

---

## 0. 새로 생긴 핵심 패턴: 팀별 카피 오버라이드 (`theme.copy`)

거의 모든 텍스트 변경이 이 패턴을 통해 이뤄졌습니다. `lib/game.ts`의 팀 정의(`TEAMS.ku`, `TEAMS.yu`)에
`copy`라는 서브 객체를 추가해서, 화면 곳곳의 고정 문자열들을 팀별로 오버라이드합니다.
없으면(`copy.xxx`가 undefined면) 기존 공통 문구로 폴백합니다.

```ts
// lib/game.ts (타입 참고용)
type TeamCopy = {
  badgeLabel?: string;                    // 상단 배지 텍스트 ("OO 공동 칼" 대체)
  galleryTitle?: string;                  // 도감 시트 제목
  gallerySheetNote?: string;              // 도감 시트 안내문
  upgradeSheetLabel?: string;             // 강화 시트 상단 라벨
  upgradeSheetNote?: string;              // 강화 시트 안내문
  upgradeBtnLabel?: string;               // 메인 강화 버튼 텍스트
  tapTabLabel?: string;                   // 강화탭 "터치" 라벨
  autoTabLabel?: string;                  // 강화탭 "자동" 라벨
  hideSheetStats?: boolean;               // true면 강화시트 하단 "OO 전체 N번" 줄 숨김
  stageHintNext?: string;                 // "다음 OO까지" 접두
  stageHintMax?: string;                  // 별 5개 다 채운 뒤 고정 문구
  revealKicker?: (short: string) => string;   // 진화 팝업 상단 문구
  unlockLabel?: (n: number) => string;    // 진화 팝업 "카드 N번 해금" 대체
  continueLabel?: string;                 // 진화 팝업 하단 버튼 텍스트
  tapHint?: (n: string) => string;        // "OO 전체가 두드린 N번" 대체
  contribLine?: (n: string) => string;    // "내가 보탠 N번" 대체
  feverIdle?: (pct: number) => string;    // 피버 대기중 게이지 문구
  feverActiveText?: string;               // 피버 활성중 고정 문구 (카운트다운 숫자 없음, 아래 8번 참고)
};
```

현재 확정된 값 (`ku` = 노아, `yu` = 연):

```ts
ku.copy = {
  badgeLabel: "노아의 검",
  galleryTitle: "진홍과 여명의 이야기",
  gallerySheetNote: "염원이 모일수록, 검법에 담겨진 이야기가 공개됩니다.",
  upgradeSheetLabel: "진홍 여명 검법의 비술",
  upgradeSheetNote: "검법에 숨겨진 비술을 획득하세요. 비술은 모두에게 적용됩니다.",
  upgradeBtnLabel: "비술 획득하기",
  tapTabLabel: "타격 강화",
  autoTabLabel: "자동 타격",
  hideSheetStats: true,
  stageHintNext: "다음 단계까지",
  stageHintMax: "비술의 성장은 끝났다. 이제는 운명을 써내려갈 차례다.",
  revealKicker: () => "비술이 강화되며, 숨겨진 이야기가 드러났다.",
  unlockLabel: (n) => `${n}번째 이야기 개방`,
  continueLabel: "계속 단련하기",
  tapHint: (n) => `모두의 염원이 ${n}만큼 모여있습니다.`,
  contribLine: (n) => `나의 염원 : ${n}`,
  feverIdle: (pct) => `여명의 빛이 밝을 때까지 ${pct}%`,
  feverActiveText: "여명이 찾아오며, 염원 획득량이 3배가 된다.",
};

yu.copy = {
  badgeLabel: "연의 검",
  galleryTitle: "천청과 비상의 이야기",
  gallerySheetNote: "검이 업그레이드 될 수록, 검법에 담겨진 이야기가 공개됩니다.",
  upgradeSheetLabel: "천청 비상 검법 모듈 시스템",
  upgradeSheetNote: "검법에 업그레이드 모듈을 장착하세요. 모듈은 모두에게 적용됩니다.",
  upgradeBtnLabel: "모듈 업그레이드",
  tapTabLabel: "타격 업그레이드",
  autoTabLabel: "자동 타격 시스템",
  hideSheetStats: true,
  stageHintNext: "다음 업그레이드까지",
  stageHintMax: "비술의 업그레이드가 완료되었다. 이제는 미래를 써내려 갈 시간이다.",
  revealKicker: () => "검술 업그레이드 완료. 비화를 공개합니다.",
  unlockLabel: (n) => `${n}번째 이야기 개방`,
  continueLabel: "계속 단련하기",
  tapHint: (n) => `모두의 데이터가 ${n}만큼 수집되었습니다.`,
  contribLine: (n) => `나의 데이터 : ${n}`,
  feverIdle: (pct) => `폭주 시스템 가동까지 ${pct}%`,
  feverActiveText: "폭주 시스템 가동. 데이터를 3배 획득합니다.",
};
```

이 세션에서 `spirit`(팀 상단 재화 이름) 값도 바뀌었습니다: `ku.spirit = "염원의 힘"`,
`yu.spirit = "데이터베이스"` (기존 "안암의 기운"/"신촌의 기운"에서 변경).

---

## 1. 검 이름 (5단계 전체 교체)

```ts
ku.stages = ["성화가 시작될 검", "홍련과 개화를 이룬 검", "진홍과 여명을 비출 검", "삼휘를 개벽해낼 검", "영겁과 휘광을 불러오는 검"];
yu.stages = ["프로토타입 : 청우", "개화 : 연희와 검", "청천 : 비상하는 검", "창천 : 개벽하는 검", "엔드 : 무궁과 천상의 검"];
```

## 2. 도감 카드 캡션 (5단계 전체 교체)

```ts
CARD_CAPTIONS.ku = [
  "새로운 전설이 시작될 검.",
  "자유와 정의, 진리를 추구하던 한 검사의 이야기.",
  "과거와 전통은 결코 무너지지 않는다.",
  "청춘을 바치고, 세계를 빛낼 검이 되어라.",
  "모두의 염원은 승리를 비출 최초의 광휘가 된다.",
];
CARD_CAPTIONS.yu = [
  "미래를 새롭게 써내려 갈 검.",
  "전설로 거듭난 미래, 그 뒤에는 외로움이 숨어있었다.",
  "진리는 자유를 평정하리라.",
  "모두의 염원은, 미래로 나아갈 가장 합리적인 데이터다.",
  "미래를 향해 비상해라. 전설은 당신의 손에 의해 쓰여질 것이다.",
];
```

캡션 표시 영역은 **한 줄 고정(ellipsis)** 처리되어 있습니다. `font-size: 11px`,
`white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`. 실기기(iPhone SE급 375px 폭 기준)에서
가장 긴 문장도 한 줄에 들어가는 걸 실측 확인했습니다 — 폭 좁은 카드에 긴 문장 새로 넣을 땐 이 폭 계산을 다시 해보는 게 안전합니다.

## 3. 도감 세계관 로어 텍스트 (신규)

도감 카드 상세보기(진화 팝업 / 도감 확대보기)에서 **제목·캡션 아래에 별도 스크롤 박스**로
단계별 세계관 텍스트가 추가됩니다. 노아·연 둘 다 5단계 전체 텍스트가 있습니다 (본문이 길어서 이 문서엔
요약 위치만 표기 — 실제 전체 텍스트는 `assets`가 아니라 데모 HTML의 `CARD_LORE` 상수에 원문 그대로 있으니
그대로 복사해서 옮기면 됩니다).

```ts
const CARD_LORE: Record<TeamId, string[]> = {
  ku: [/* 노아 1~5단계 세계관 텍스트, 데모 HTML의 CARD_LORE.ku 그대로 복사 */],
  yu: [/* 연 1~5단계 세계관 텍스트, 데모 HTML의 CARD_LORE.yu 그대로 복사 */],
};
```

렌더링 위치: 진화 팝업(`.reveal-card`)과 도감 확대보기(`.gallery-zoom`) 둘 다, `<p class="reveal-caption">` 바로 아래.

```css
.reveal-lore {
  margin-top: 14px; max-height: 34dvh; overflow-y: auto; -webkit-overflow-scrolling: touch;
  padding: 12px 14px; border-radius: 12px; background: rgba(0,0,0,0.32);
  border: 1px solid rgba(255,255,255,0.1); font-size: 12.5px; line-height: 1.75;
  color: rgba(255,255,255,0.82); text-align: left;
}
```

박스 자체가 스크롤되므로 팝업 전체 높이는 늘어나지 않습니다.

## 4. 도감 카드 아트 — "웅장 모드" (5단계 전용)

5단계(및 이후 후일담 카드처럼 `stage >= 4`인 카드) 아트는 **단일 포커스 뷰(진화 팝업/도감 확대보기)**에서만
기존 3:4 세로 카드 틀 대신 훨씬 큰 정사각형(1:1) 틀로 렌더링됩니다. 도감 그리드의 작은 썸네일은 그대로 3:4 유지.

```ts
function cardArtHTML(card, theme, locked, grand: boolean) {
  // grand=true면 .card-art 대신 .card-art.card-art-grand 클래스 사용
  // 그리드 썸네일 호출부는 항상 grand=false, 진화팝업/확대보기는 card.stage >= 4일 때 grand=true
}
```

```css
.card-art.card-art-grand { aspect-ratio: 1 / 1; }
.reveal-card--grand { width: min(96vw, 440px); }          /* 진화 팝업 카드 자체도 더 넓게 */
.reveal-card--grand .reveal-frame { margin: 0 -12px 0; padding: 4px; }
.gallery-zoom .reveal-frame.reveal-frame--grand { width: min(94vw, 420px); padding: 4px; }
```

카드 아트 렌더링 자체는 "블러 배경 + 선명한 원본" 2겹 구조를 그대로 씁니다 (1차 SPEC과 동일한 패턴):

```html
<div class="card-art card-art-photo [card-art-grand]">
  <img class="card-art-bg" src="..." aria-hidden="true" />   <!-- blur(16px) + cover, 칸을 꽉 채움 -->
  <img class="card-art-img" src="..." />                      <!-- contain, 절대 안 잘림 -->
</div>
```

## 5. 도감 6번째 칸: "후일담" 보너스 카드 (신규)

일반 5단계 진화 카드와 별개로, **연마(별) 5개를 채워야 열리는** 6번째 카드가 도감 그리드 끝에 붙습니다.
일반 카드처럼 `stage <= 현재단계`로 잠금 판정하는 게 아니라 별도 조건입니다.

```ts
const BONUS_CARDS = {
  ku: { title: "후일담 : 아리아의 전언", requiredStars: 5, caption: "" },
  yu: { title: "후일담 : 연희의 기록 - 2080년으로부터", requiredStars: 5, caption: "" },
};

function isCardLocked(card, stage, stars, maxStage) {
  if (card.bonus) return !(stage >= maxStage && stars >= card.requiredStars);
  return card.stage > stage;
}
```

- 잠금 상태일 땐 다른 카드와 동일하게 "?" + `disabled`.
- **해금되는 순간 다른 카드처럼 팝업 UI가 뜹니다** (아래 6번 "카드 팝업 재사용" 참고). 다만 후일담 카드는
  "생산량 ×N" 같은 검 강화 수치 줄은 의미가 없어서 그 줄만 숨깁니다 (`card.bonus`면 렌더링 스킵).
- **일러스트/제목 확정 전 상태**: 지금은 아직 그림이 없어서(`card-art` 폴백 = 심볼+제목+"일러스트 준비 중") 그대로
  둬도 되고, 나중에 그림 받으면 스테이지 배열 6번째 인덱스에 추가하면 자동으로 웅장모드까지 적용됩니다
  (`isGrand = card.stage >= 4` 조건이 6번째 카드도 포함하도록 이미 되어 있음).

## 6. 진화/후일담 카드 팝업 리팩터 (재사용 가능하게 분리)

기존엔 `showCardReveal(stage)` 하나가 `stage` 인덱스로 카드를 직접 찾아 렌더링했는데, 후일담 카드처럼
"진짜 스테이지 인덱스가 아닌" 카드도 같은 팝업을 띄워야 해서 **카드 객체를 직접 받는 함수로 분리**했습니다.

```ts
function showCardReveal(stage: number) {
  const cards = cardsFor(team, theme.stages);
  showCardRevealForCard(cards[Math.min(stage, cards.length - 1)]);
}

function showCardRevealForCard(card) {
  // 실제 팝업 렌더링 로직 (기존 showCardReveal 본문 그대로, card 인자만 밖에서 받음)
  // card.bonus가 true면 kicker 문구를 "새로운 이야기가 도착했다"로 고정
}
```

## 7. 튜토리얼(비주얼노벨식 첫 진입 연출) — 신규 기능

**진영을 처음 고를 때 1회만** 나오는 대화 연출입니다. `storage`(유저별 영구 저장)에 `tutorialSeen:{team}`
플래그를 저장해서 다시는 안 나오게 합니다. 실제 레포에선 이 플래그를 Supabase 유저 프로필이나
로컬스토리지에 저장하면 됩니다.

**동작 흐름**: 팀 선택 → (스탠딩 아트 우측/좌측 + 어두운 스크림 오버레이) → 대사 여러 줄(탭으로 진행,
좌상단 스킵 가능) → 완료 시 게임 화면 진입 **직후 1단계 도감 카드 팝업도 자동으로 뜸** (6번 항목의
`showCardRevealForCard` 재사용).

```ts
const TUTORIALS = {
  ku: {
    name: "노아", side: "right",     // 스탠딩 위치: 노아=우측, 연=좌측
    standeeSrc: "/images/standee/ku-tutorial-standee.webp",
    lines: [
      "당신이군요.. 이 검의 주인이. 기다리고있었어요.",
      "이 검에는 진홍과 여명이 깃들어있어요. 고대로부터 내려져온, 전설의 비검이랍니다. 이번에는 검이 당신을 선택한 것 같아요.",
      "이 검은 쉽게 사용할 수 없답니다. 검을 터치해서 염원을 만들어내고, 모두와 함께 검법을 익혀주세요. 검은 반드시, 당신의 의지를 따르게 될거에요.",
      "이렇게 모인 염원은, 검의 비술을 익히고 강화하는 곳에 사용할 수 있습니다.",
      "또, 당신이 검법을 익혀갈수록.. 저에 대한 이야기를 들을 수 있을거에요.",
      "뭇별의 너머에서 기다리고 있겠습니다. 여행자님.",
      "기억해요. 여명은, 혼자서는 밝힐 수 없다는 것을...",
    ],
  },
  yu: {
    name: "연", side: "left",
    standeeSrc: "/images/standee/yu-tutorial-standee.webp",
    lines: [
      "...! 드디어 찾았군. 기다리고있었다.",
      "네가 바로.. 천청검법 프로토콜을 완성시킬 녀석이로구나.",
      "너에게 천청검법의 정수가 담긴 <청우>를 전송했다. 검을 터치해서 데이터를 쌓고, 모두와 함께 공유하여 검술을 강화하도록.",
      "데이터가 많아질수록, 검술에 적용할 수 있는 모듈을 업그레이드 할 수 있을거야.",
      "검술이 완성될 때 마다.. 나의 목적과 진실을 알게될지도 모르지.",
      "뭇별의 너머에서 기다리겠다, 여행자. 청우를 부탁할게.",
      "기억해. 승리를 비출 서광은, 모두에게 달려있다는 걸.",
    ],
  },
};
```

**타이핑/진행 방식**: 대사는 통째로 즉시 표시(타자 효과 없음), 화면 탭 = 다음 줄. 마지막 줄에서 탭하면 종료.
스킵 버튼은 즉시 종료 + `tutorialSeen` 플래그 저장.

**배경 처리**: 튜토리얼 화면 배경은 완전 검은색이 아니라, **그 팀의 1단계 게임 배경 이미지**를 깔고
그 위에 반투명 스크림(`linear-gradient(180deg, rgba(5,2,8,0.5) 0%, rgba(5,2,8,0.3) 45%, rgba(5,2,8,0.72) 100%)`)을
얹은 것 — 완전 암전이 아니라 "게임 화면이 은은하게 비치는" 느낌.

⚠️ **중요**: 이 오버레이는 반드시 `.app-frame`(모바일 폭 컨테이너) **내부에 절대 위치**로 렌더링해야 합니다.
`position: fixed`로 하면 데스크톱 브라우저에서 전체 브라우저 폭을 차지해버려서 모바일 프레임을 벗어납니다
(`position: absolute; inset: 0;` + 부모가 `.app-frame`이어야 함).

## 8. 검이 5단계에 도달하는 순간 — 전용 컷씬 (신규)

**5단계에 처음 도달하는 순간** 기존 도감 팝업 대신 아래 흐름의 컷씬이 뜹니다. 노아·연 둘 다 있습니다.
**이미 5단계인 상태로 재접속한 유저에게도, 아직 못 봤다면 게임 화면 진입 시 1회 자동 재생**됩니다
(`evolveCutsceneSeen:{team}` 플래그로 관리).

**흐름**: 화면 암전(이 시점에 BGM은 이미 5단계 그룹 트랙으로 자동 전환되어 있음, 기존 단계별 BGM 로직 그대로 재사용)
→ 대사 4줄(탭 진행, 좌상단 스킵) → 화면 번쩍(흰색 플래시) → **최종 일러스트를 화면 세로 꽉 채워서 표시(양옆은
자연스럽게 크롭)** → 화면 상단에 "5단계 도감의 이야기가 해금되었습니다" 배너(어두운 그라데이션 스크림으로
가독성 확보) → 하단에 캡션 문구 → 5초 뒤 자동 종료(또는 스킵).

```ts
const EVOLVE_CUTSCENES = {
  ku: {
    lines: [
      { name: "나", text: "불꽃이 일렁이며, 누군가의 모습이 드러난다." },
      { name: "노아", text: "드디어, 긴 여정의 끝에 도달하셨군요." },
      { name: "노아", text: "이제는 승리의 여명을 불러올 차례입니다." },
      { name: "노아", text: "뭇별을 넘어, 당신의 진정한 미래로 나아가세요." },
    ],
    imageSrc: "/images/gallery/ku-stage5-cutscene-reveal.png",   // 무손실 원본 그대로 사용 (재압축 금지)
    caption: "승리의 여신 노아가 당신을 주시한다.",
  },
  yu: {
    lines: [
      { name: "나", text: "푸른 파도가 주변을 휩쓸며, 누군가의 모습이 드러난다." },
      { name: "연", text: "믿고있었어, 여행자. 드디어 완성시켰구나." },
      { name: "연", text: "여명의 빛을 가져올 영웅은.. 바로 너였던거야." },
      { name: "연", text: "이제 새로운 미래를 개척할 시간이야. 자, 모두에게 알려주자고. 너의 '완성작'을!" },
    ],
    imageSrc: "/images/gallery/yu-stage5-cutscene-reveal.png",
    caption: "승리의 여신 연이 당신을 주시한다.",
  },
};
```

⚠️ **이미지 화질 주의**: 처음엔 이 최종 일러스트를 영상(webm)으로 재생하려 했는데 화질 손실이 있어서,
**정지 이미지로 교체하고 압축 없이 원본 그대로** 쓰기로 했습니다 (`ku-stage5-cutscene-reveal.png`는
무손실 PNG 원본, `yu-...png`는 투명 여백만 제거한 고화질 WebP). Next.js `<Image>`로 쓸 때 `quality` 옵션을
100에 가깝게 주거나, 아예 최적화를 끄고 원본을 그대로 서빙하는 걸 권장합니다.

**표시 방식**: `height: 100%; width: auto;`로 화면 세로를 꽉 채우고, 정사각형에 가까운 이미지라 폭이
자연스럽게 화면 밖으로 넘쳐서 양옆이 잘리는 방식(의도된 크롭 — "캐릭터를 최대한 크게" 요청 반영).

**진입 조건 분기**: 이 컷씬이 있는 팀(현재 노아·연 둘 다 있음)은 5단계 도달 시 **기존 진화 팝업 대신** 이 컷씬이
뜹니다. 컷씬이 없는 팀(향후 3번째 팀 추가 시)은 기존 방식(도감 팝업)으로 자동 폴백.

## 9. 별(연마) 시스템 확장 — 5단계 이후에도 계속 성장

5단계(마지막 진화 단계) 도달 후에도 게이지가 멈추지 않고 계속 차오르며, **채울 때마다 별이 붙습니다
(최대 5개)**. 이 로직 자체는 원래 있었는데, 도중에 실수로 표시 문구를 고정 텍스트로 덮어써서 숨겨져
있었던 걸 이번에 복구 + 확장했습니다.

```ts
const MAX_STARS = 5;

function starRank(lifetime) {
  const last = STAGE_THRESHOLDS[STAGE_THRESHOLDS.length - 1];
  if (lifetime < last) return 0;
  const rank = Math.floor(Math.log(lifetime / last) / Math.log(4));  // 별 하나당 필요량 x4씩 증가
  return Math.min(rank, MAX_STARS);
}

function stageProgress(lifetime) {
  // isMax=true인 경우: starRank가 MAX_STARS 미만이면 다음 별까지 진행률 계산해서 게이지 계속 표시.
  // MAX_STARS에 도달하면 { ratio: 1, starsMaxed: true } 고정 반환 — 더 이상 진행 안 함.
}
```

**HUD 표시**: `stageHint` 텍스트는 `!starsMaxed`면 `"${copy.stageHintNext} N"` 형태로 다음 별까지 남은 양을
계속 보여주고(문구는 "다음 연마 단계까지 N"으로 통일), `starsMaxed`가 되어야 `copy.stageHintMax` 고정 문구로 전환.
단계 이름 옆에는 `★`를 별 개수만큼(`Math.min(stars, 5)`) 붙여서 표시.

## 10. 별 오라 — 검 주변 발광 효과 (신규)

별이 붙을 때마다 검 뒤에 팀 색상(`--glow` CSS 변수 재사용: 노아=`#ff4d6d`, 연=`#3aa0ff`) 오라가 은은하게
켜집니다. **처음엔 "별 N/5" 텍스트 + 링 이펙트가 터지는 축하 연출도 넣었었는데, 사용자 피드백으로 완전히
제거**했고, 지금은 아래처럼 조용히 상시 발광하는 방식만 남았습니다.

```ts
// 별 획득 시 별도 이펙트/사운드 없음. checkStageAndFever()에서 stars 갱신만 하고 끝.
```

렌더링은 검 이미지 자체가 아니라 **별도의 흐릿한 발광 레이어**로 분리했습니다 (검 필터에 겹겹이
drop-shadow를 쌓았더니 너무 밝아지는 문제가 있었음).

```css
#swordSvgWrap { position: relative; }
.sword-aura {
  position: absolute; left: 50%; top: 58%; transform: translate(-50%, -50%); border-radius: 50%;
  pointer-events: none; z-index: 0;
  background: radial-gradient(circle, rgba(var(--glow-rgb), 1) 0%, rgba(var(--glow-rgb), 0) 72%);
  filter: blur(16px);
  animation: swordAuraBreathe 6s ease-in-out infinite;   /* 6초 주기로 천천히 밝기 오르내림 */
}
@keyframes swordAuraBreathe { 0%, 100% { opacity: var(--aura-min); } 50% { opacity: var(--aura-max); } }
```

```ts
// 별 개수(1~5)별 크기/최대밝기. 최소밝기는 최대의 55%로 (완전히 안 보이는 구간 없게).
const AURA_SIZE = [0, 112, 138, 164, 190, 216];   // index = 별 개수
const AURA_PEAK = [0, 0.15, 0.21, 0.28, 0.35, 0.42];
// 별 0개면 오라 없음.
```

`--glow-rgb`는 hex `--glow` 값을 `"255, 77, 109"` 형태로 변환해서 별도 CSS 변수로 세팅해둔 것
(rgba()에서 알파값 커스텀하려면 필요). `hexToRgbString()` 헬퍼 하나만 추가하면 됩니다.

## 11. 검 크기 — 단계별로 점점 커짐 (신규)

```ts
const SWORD_STAGE_SCALE = [1.0, 1.06, 1.12, 1.19, 1.27];  // index = stage(0~4)
```

`transform: scale(N)`을 검 이미지에 직접 적용, `transform-origin: 50% 62%`(중심보다 살짝 아래)로 잡아서
위아래로 고르게 커지도록 함. 처음엔 바닥 기준(`100%`)으로 위로만 크게 했는데, 너무 위로 쏠려 보인다는
피드백으로 62%로 조정했습니다.

⚠️ **z-index 주의**: 검이 프레임 위로 살짝 넘칠 수 있어서, HUD/하단 버튼/게이지바가 항상 검보다 **확실히
높은 z-index**를 갖도록 해야 합니다 (안 그러면 커진 검이 텍스트를 가려버림 — 실제로 이 문제가 있었고
z-index 재정렬로 고쳤습니다).

```css
.hud { z-index: 6; }          /* 기존 2에서 상향 */
.dock { z-index: 5; }         /* 기존 2에서 상향 */
.stage-area { z-index: 2; }   /* 검이 속한 영역, 그대로 */
.sword-img { z-index: 1; }    /* 검 자체는 낮게 */
.tap-hint, .contrib { z-index: 3; position: relative; }  /* 추가 안전장치 */
```

## 12. 사운드 시스템 개편

### 12-1. 검 터치 사운드 (기존 합성음 → 실제 파일)

기존엔 Web Audio API로 합성한 "띵" 소리였는데, 실제 사운드 파일로 교체했습니다. 매 터치마다
**3개 중 하나를 동일 확률로 무작위 재생**, 겹쳐 눌러도 안 끊기게 매번 새 `Audio` 인스턴스를 생성합니다.

```ts
const TAP_SOUNDS = ["/audio/tap/tap-sound-1.mp3", "/audio/tap/tap-sound-2.mp3", "/audio/tap/tap-sound-3.mp3"];
```

### 12-2. 3단계 도달 후 특수 사운드 추가 (팀별 가중치 랜덤)

검이 **3단계**에 도달한 이후부터는, 위 3종 풀에 팀 전용 사운드가 추가되고 **기존 3개보다 살짝 더 높은
확률**로 뽑힙니다 (가중치: 기존 3개 각 weight 1, 특수음 weight 1.4).

```ts
const STAGE3_SPECIAL_SOUND = {
  ku: "/audio/tap/stage3-special-ku.mp3",
  yu: "/audio/tap/stage3-special-yu.mp3",
};

function pickTapSound(team, stage) {
  const pool = TAP_SOUNDS.map((s) => ({ sound: s, weight: 1 }));
  if (stage >= 2) pool.push({ sound: STAGE3_SPECIAL_SOUND[team], weight: 1.4 });
  // 가중치 기반 랜덤 뽑기
}
```

### 12-3. 도감 카드 해금 사운드 (신규, 전용 효과음)

진화 카드 팝업(및 후일담 카드 팝업)이 뜰 때 재생되는 전용 사운드. 피버 배너의 기존 팬파레 합성음과는
별개입니다.

```ts
const CARD_REVEAL_SOUND = "/audio/misc/card-reveal-sound.mp3";
```

### 12-4. 피버 시작 사운드 (신규, 전용 효과음)

```ts
const FEVER_START_SOUND = "/audio/misc/fever-start-sound.mp3";
```

### 12-5. 볼륨 설정 (환경설정 패널, 14번 항목 참고)

`tapVolume`(터치 사운드류 전부 공용), `bgmVolume`(타이틀/게임 BGM 공용) 두 값을 유저별로 저장하고,
모든 `Audio` 인스턴스 생성 시 이 값을 `volume`에 반영합니다.

## 13. 피버 시스템 개편

### 13-1. 게이지 시각적 카운트다운 (신규)

피버 활성 중에는 게이지바가 가득 찬 상태(100%)에서 시작해 **남은 시간에 비례해 오른쪽→왼쪽으로 줄어들며**
0%가 되는 순간 자연스럽게 피버가 끝납니다. 별도 숫자 카운트다운 텍스트는 없음(게이지 자체가 카운트다운).

```ts
const feverRemainRatio = feverActive
  ? Math.max(0, Math.min(1, (sword.feverUntil - Date.now()) / FEVER_DURATION_MS))
  : 0;
feverFillWidth = feverActive ? feverRemainRatio * 100 : feverGaugePercent;
```

피버가 끝나면 `feverGauge`는 0으로 초기화된 상태 그대로이므로(피버 중엔 게이지 적립이 멈춰있음) 자동으로
빈 상태가 됩니다.

### 13-2. 피버 시작/활성 텍스트 (기존 "응원 열기!" 팝업 완전 삭제)

- 화면 중앙에 크게 뜨던 "응원 열기!" 모달 팝업은 **완전히 제거**했습니다. 사운드/진동 피드백만 남김.
- 게이지바 안 텍스트는 피버 활성 중엔 `copy.feverActiveText` 고정 문구(위 0번 항목 참고, 팀별로 다름).

### 13-3. 피버 시작 시 캐릭터 팝업 (신규, 3단계 티어)

피버가 시작되는 순간, 화면 하단 구석(**노아=우측, 연=좌측**)에서 캐릭터 일러스트가 팝업으로 튀어나오고
머리 위에 말풍선이 뜹니다. 약 2초 유지 후 부드럽게 페이드아웃(총 노출 2.6초).

검의 현재 단계에 따라 **그림과 대사가 3단계로 달라집니다**:

```ts
const FEVER_POP = {
  ku: {
    side: "right",
    tier1: { src: "/images/fever-pop/ku-tier1-normal.webp", text: "지금이, 여명의 순간입니다!" },       // 1~3단계
    tier2: { src: "/images/fever-pop/ku-tier2-stage4.webp", text: "지금이, 여명의 순간입니다!" },        // 4단계
    tier3: { src: "/images/fever-pop/ku-tier3-stage5.webp", text: "여명의 빛이, 늘 당신과 함께하길.." }, // 5단계
  },
  yu: {
    side: "left",
    tier1: { src: "/images/fever-pop/yu-tier1-normal.webp", text: "폭주 시스템이 가동되었다!" },
    tier2: { src: "/images/fever-pop/yu-tier2-stage4.webp", text: "폭주 시스템이 가동되었다!" },
    tier3: { src: "/images/fever-pop/yu-tier3-stage5.webp", text: "대단하군. 폭주 시스템을 제어할 줄이야." },
  },
};

function pickFeverPopTier(stage) {
  if (stage >= 4) return "tier3";   // 5단계
  if (stage >= 3) return "tier2";   // 4단계
  return "tier1";                   // 1~3단계
}
```

⚠️ 여기 인덱싱은 **0-based**입니다 (`stage`는 `stageOf(lifetime)`이 반환하는 0~4 값). "4단계"는 `stage === 3`,
"5단계"는 `stage === 4`입니다 — 처음 구현할 때 이 부분에서 실수해서 4단계에 옛날 그림이 나온 적이 있으니
실제 이식할 때도 이 인덱스 기준을 꼭 확인하세요.

```css
.fever-pop { position: absolute; bottom: calc(118px + env(safe-area-inset-bottom)); z-index: 4;
  pointer-events: none; display: flex; flex-direction: column; align-items: center;
  animation: feverPopFade 2.6s ease forwards; }
.fever-pop.side-right { right: 2%; align-items: flex-end; }
.fever-pop.side-left { left: 2%; align-items: flex-start; }
.fever-pop-img { height: 30dvh; max-height: 240px; }              /* tier1 */
.fever-pop.fever-pop-big .fever-pop-img { height: 46dvh; max-height: 380px; }     /* tier2 */
.fever-pop.fever-pop-biggest .fever-pop-img { height: 56dvh; max-height: 460px; } /* tier3 */
.fever-pop-bubble { /* 말풍선, 캐릭터 이미지 바로 위, 꼬리(::after)로 캐릭터 쪽을 가리킴 */ }
@keyframes feverPopIn { 0% { opacity:0; transform: scale(0.7) translateY(14px);} 60%{opacity:1; transform:scale(1.06);} 100%{transform:scale(1);} }
@keyframes feverPopFade { 0%, 78% { opacity: 1; } 100% { opacity: 0; } }
```

## 14. 환경설정 패널 (신규)

상단 HUD의 스피커(🔊) 아이콘 옆에 ⚙️ 버튼 추가. 누르면 시트가 열리고:

1. **BGM 볼륨** 슬라이더 (0~100, 즉시 반영)
2. **터치 사운드 볼륨** 슬라이더 (0~100, 다음 재생부터 반영)
3. **"일러스트 & BGM 다운로드 페이지로 이동"** 버튼 — 현재 `href="#"` placeholder, 실제 링크 확정되면 교체 필요
4. **제작자 정보** — 현재 "추후 업데이트 예정입니다" placeholder, 문구 확정되면 교체 필요

볼륨 두 값은 유저별로 영구 저장되어 다음 접속 때도 유지됩니다 (`settings:bgmVolume`, `settings:tapVolume` 키).

## 15. 기타 UI 텍스트/가독성 수정

- 텍스트 대비가 너무 낮았던 요소들 opacity 상향 조정: "나의 염원/데이터" 라인, "모두의 염원이…" 라인
  (원래 breathe 애니메이션이 0.35~0.85로 오르내려서 어두울 때 거의 안 보였음 → 0.7~1로 조정),
  "다음 단계까지 N" 라인, 첫 화면 하단 안내문. 전부 팀 공통 스타일이라 두 팀 다 동일 적용.
- 진화 팝업의 "생산량 ×N" 배수 표시가 예전 계산식(고정 1.5)에 멈춰 있던 버그 발견 → 실제 `STAGE_GROWTH`
  상수를 참조하도록 수정 (현재 1.85).
- 디버그(테스트) 패널에 버튼 2개 추가: **"응원 열기(피버) 즉시 발동"**, 그리고 기존 "다음 진화 단계로
  스킵" 버튼이 **5단계 도달 후에는 별을 1개씩 추가**하도록 동작 확장 (별 5개 찍으면 더 이상 반응 없음).

---

## 자산 파일 안내 (`assets/`)

```
assets/
  images/
    gallery/            도감 카드 아트 (팀별 1~5단계 + 5단계 컷씬용 별도 고화질본)
      ku-stage1.webp ~ ku-stage5.webp
      yu-stage1.webp ~ yu-stage5.webp
      ku-stage5-cutscene-reveal.png   ← 컷씬 전용, 무손실 원본 그대로 사용할 것
      yu-stage5-cutscene-reveal.png
    standee/             튜토리얼 스탠딩 아트
      ku-tutorial-standee.webp
      yu-tutorial-standee.webp
    tap-effect/          검 터치 시 터지는 파티클 이펙트 (애니메이션 WebP, 알파 투명)
      ku-tap-effect.webp
      yu-tap-effect.webp
    fever-pop/            피버 시작 시 팝업 캐릭터 (티어 1/2/3)
      ku-tier1-normal.webp / ku-tier2-stage4.webp / ku-tier3-stage5.webp
      yu-tier1-normal.webp / yu-tier2-stage4.webp / yu-tier3-stage5.webp
  audio/
    tap/
      tap-sound-1.mp3, tap-sound-2.mp3, tap-sound-3.mp3   (공용 3종)
      stage3-special-ku.mp3, stage3-special-yu.mp3         (3단계 이후 팀별 추가음)
    misc/
      card-reveal-sound.mp3     (도감 카드 해금 팝업 사운드)
      fever-start-sound.mp3     (피버 시작 사운드)
```

`tap-effect/*.webp`는 **애니메이션 WebP**(투명 배경, 알파 채널 포함)입니다 — 원본이 알파 있는
VP9(WebM)/QuickTime Animation 영상이었는데, `<video>` 태그는 웹에서 알파를 못 살려서 프레임을 뽑아
애니메이션 WebP로 재구성한 것입니다. Next.js `<Image>`로는 애니메이션이 재생 안 되니, 일반
`<img src="...">` 태그로 써야 자동재생됩니다.
