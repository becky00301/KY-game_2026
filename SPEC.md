# 데모 → 실제 레포 반영 스펙

이 문서는 `ky-game-preview.html` 단일 파일 데모(Claude.ai 채팅에서 만든 오프라인 미리보기)에서
실제로 확정된 변경사항을 정리한 것입니다. 실제 레포는 Next.js + Supabase 구조이고,
데모는 서버 없이 로컬 상태로만 동작하는 것이므로 **그대로 복붙이 아니라 구조에 맞게 이식**해야 합니다.

이 폴더의 `assets/` 안에 이번에 확정된 이미지·오디오 원본 파일이 전부 들어있습니다
(데모 HTML 안에 base64로 박혀있던 걸 실제 파일로 꺼낸 것). Next.js에서는 이걸 `public/` 아래에
두고 `<Image src="/..." />` 나 `<audio src="/...">` 로 참조하면 됩니다.

---

## 1. 진화 단계 7 → 5로 축소

**`lib/engine.ts`**
```ts
export const STAGE_THRESHOLDS = [0, 50000, 1500000, 45000000, 1500000000];
// 5개 값 = 5단계(index 0~4). 기존 7개(0~6)에서 축소.

export const STAGE_GROWTH = 1.85;
// 기존 1.5. 단계 수가 줄어든 만큼 단계당 배율을 올려서
// 최종 생산량 배율(옛 1.5^6 ≈ 11.4)을 새 5단계에서도 비슷하게(1.85^4 ≈ 11.7) 유지.
```

**`lib/game.ts`** — 팀별 `stages` 배열을 5개로:
```ts
ku.stages = ["낡은 연습검", "안암 단련검", "호랑이 발톱검", "고연전 승리검", "전설의 안암검"];
yu.stages = ["낡은 연습검", "신촌 단련검", "독수리 날개검", "연고전 승리검", "전설의 신촌검"];
```

**`lib/cards.ts`** — 캡션도 5개로 (기존 캡션 중 남은 단계에 맞는 것만 재사용):
```ts
ku: ["아직 아무 기운도 담기지 않은 검.", "수없이 두드려 단단해진 날.", "호랑이의 발톱이 검에 새겨졌다.", "고연전을 위해 벼려진 검.", "안암의 모든 기운이 하나로 모였다."]
yu: ["아직 아무 기운도 담기지 않은 검.", "수없이 두드려 단단해진 날.", "독수리의 날개가 검에 새겨졌다.", "연고전을 위해 벼려진 검.", "신촌의 모든 기운이 하나로 모였다."]
```

> ⚠️ Supabase 쪽: 단계 계산은 `STAGE_THRESHOLDS.length` 기반이라 서버 함수(`applyTaps` 등)도
> 같은 상수를 쓰고 있다면 자동으로 5단계에 맞춰짐. `supabase/schema.sql`이나 서버리스 함수에
> 임계값이 하드코딩돼 있는지 확인 필요.

---

## 2. 첫 화면(팀 선택) 배경 + 타이틀 로고

- 배경: `assets/images/logo/` 옆에는 없고, 별도로 받은 팀 선택 배경 이미지(빨강/파랑 대비되는 세로 아트)를
  select 화면 배경으로, 위에 어두운 그라데이션 스크림을 겹쳐서 글자 가독성 확보.
  ```css
  background-image:
    linear-gradient(180deg, rgba(7,3,10,0.55) 0%, rgba(7,3,10,0.68) 45%, rgba(7,3,10,0.9) 100%),
    url("/images/select-bg.webp");
  background-size: cover; background-position: center top;
  ```
  (이 특정 배경 파일은 이번 assets 폴더에는 없음 — 최초 업로드분 별도 보관 필요하면 말씀해주세요)
- 타이틀 로고: `assets/images/logo/title-logo.webp` — "고연전 응원 클리커" 텍스트 + "모두가 두드리는 하나의 검" 문구를
  없애고 이 로고 이미지로 교체. `max-width: 400px`, 가운데 정렬.

## 3. 팀 선택 카드 스타일

- 배경: 팀 테마 `primaryDeep` 색을 반투명(62%/22% 두 겹)으로 깔고 `backdrop-filter: blur(6px)`로
  뒤 배경이 살짝 비치게.
- 테두리: 팀 `glow` 색, 1.5px, 55% 불투명도 (눌렀을 때 85%로).
- 🐯/🦅 이모지 제거 (팀 선택 화면에서만).

## 4. 배경음악

### 4-1. 첫 화면 전용 (`assets/audio/bgm-title/bgm-title-select.mp3`, 96kbps, 2분, 루프)
- 첫 화면(팀 선택)에서만 자동재생 시도 (브라우저 정책상 막히면 첫 터치에서 재시도).
- 우측 상단 🔊/🔇 버튼으로 토글.
- 다른 화면으로 넘어가면 완전히 정지.

### 4-2. 게임 화면 전용 (`assets/audio/bgm-gameplay/`, 각 96kbps, 30초 루프)
- 진화 단계를 3개 그룹으로 묶어서 트랙 배정 (배경 이미지와 동일한 그룹핑):
  - `bgm-{team}-stage0-1.mp3` → 1~2단계 (index 0,1)
  - `bgm-{team}-stage2-3.mp3` → 3~4단계 (index 2,3)
  - `bgm-{team}-stage4.mp3` → 5단계 (index 4)
- 단계 그룹이 바뀔 때만 트랙 교체 (같은 `<audio>` 엘리먼트의 `src`만 교체 — 매번 새 엘리먼트를 만들면
  자동재생이 막히기 쉬움).
- **기존 사운드(🔊/🔇) 버튼과 연동**: 이 버튼을 누르면 타격 효과음뿐 아니라 이 게임 브금도 같이 음소거.
- 팀 선택 화면으로 돌아가면 정지.

## 5. 단계별 배경 이미지 (`assets/images/bg/`)

- 배경음악과 동일하게 0~1 / 2~3 / 4 세 그룹으로 나눠서 `.game` 화면 배경에 적용.
- 칼이 항상 잘 보이도록 어두운 스크림을 이미지 위에 겹침:
  ```css
  background-image:
    radial-gradient(66% 50% at 50% 44%, rgba(5,2,8,0.68), rgba(5,2,8,0.15) 70%),
    linear-gradient(180deg, rgba(5,2,8,0.62) 0%, rgba(5,2,8,0.42) 35%, rgba(5,2,8,0.60) 70%, rgba(5,2,8,0.88) 100%),
    url("/images/bg/bg-{team}-{group}.webp");
  background-size: cover; background-position: center top;
  ```
  (라디얼 그림자는 칼이 서는 자리를 한 번 더 어둡게 해서 배경 art의 밝은 중앙 장식과 칼이 겹쳐 안 보이는 문제를 방지)

## 6. 실제 칼 이미지 (`assets/images/sword/`, 단계별 1:1, 그룹 없음)

- 기존엔 `components/Sword.tsx`가 SVG를 절차적으로 그렸는데, 이제 단계별 실제 이미지로 교체.
- **중요 제약: 칼 이미지가 절대 잘리면 안 됨.** 단계마다 가로세로 비율이 꽤 다르므로
  (1단계는 세로로 길쭉, 5단계는 날개/리본 때문에 훨씬 넓적) `object-fit: contain`으로 렌더링:
  ```css
  .sword-box { width: min(74vw, 300px); height: min(52dvh, 420px); display: flex; align-items: center; justify-content: center; }
  .sword-img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; }
  ```
- 응원 열기(fever) 중에는 `filter: drop-shadow(0 0 26px var(--glow)) brightness(1.12)` 추가로 글로우 효과.
- 이미지가 없는 팀/단계가 생기면 기존 SVG 절차적 생성 방식으로 자동 폴백 (지금은 고대·연대 둘 다 5단계 전부 있음).

## 7. 학교 심볼 (호랑이/독수리 이모지 → 실제 심볼 이미지)

- `assets/images/emblem/emblem-ku.webp`, `emblem-yu.webp`: 기본 심볼. "OO 공동 칼" 배지(18px 원형)와
  도감 카드 폴백 아이콘(카드 너비의 62%, 최대 190px, 원형)에 사용.
- `assets/images/emblem/emblem-ku-stage5.webp`, `emblem-yu-stage5.webp`: **검이 5단계(최종)에 도달하면**
  위 두 자리(배지 + 도감 폴백 아이콘) 전부 이 "진화한 심볼"로 자동 교체. 5단계 미만이면 기본 심볼 유지.

## 8. UI 디테일

- 강화 시트(`UpgradeSheet`)와 칼 도감(`CardGallery`) 배경을 완전 검정(`#000`)으로 통일 (기존엔 `#1b1016→#0d0710` 그라데이션).

---

## 압축 스펙 (다음에 이미지/오디오 추가할 때 참고)

| 종류 | 리사이즈 | 포맷/화질 |
|---|---|---|
| 배경 이미지 (전신 배경) | 가로 640px | WebP q60 |
| 검 이미지 (전경 히어로 아트) | 원본 유지 (업스케일 금지) | WebP q45 |
| 심볼/엠블럼 (작게 쓰임) | 200px (5단계 심볼은 320px) | WebP q55 |
| 타이틀 로고 | 크롭 후 840px | WebP q75 |
| 배경음악 (30초 루프) | - | MP3 96kbps stereo |
| 배경음악 (첫화면, 2분) | - | MP3 96kbps stereo |

---

## 이식 우선순위 제안

1. `STAGE_THRESHOLDS` / `STAGE_GROWTH` / `stages` / `cards.ts` 캡션 (숫자만 바꾸면 되는 부분, 제일 쉬움)
2. 학교 심볼 이미지 교체 (이모지 → `<img>`, 5단계 진화 로직 포함)
3. 단계별 배경 이미지 + 스크림
4. 실제 칼 이미지 (`Sword.tsx`를 이미지 렌더링으로 전환, object-fit:contain 필수)
5. 배경음악 (첫화면 + 게임화면 두 시스템)
6. 팀 선택 화면 리디자인 (로고, 카드 스타일, 배경)
7. 강화 시트/도감 배경 검정 통일

Claude Code에서 이 문서를 보여주고 "1번부터 순서대로 진행해줘" 라고 하면 순서대로 작업할 수 있습니다.
