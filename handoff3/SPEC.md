# 데모 → 실제 레포 반영 스펙 (3차)

1차·2차 핸드오프(SPEC.md + MISSING-ITEMS.md) 이후, `ky-game-preview.html` 데모에서 추가로 확정된
변경사항만 정리한 것입니다. 이전 내용은 이미 반영되었다는 전제로, 여기서는 새로 추가된 것만 다룹니다.

이 폴더 `assets/`에 이번에 확정된 아이콘 이미지 14개가 들어있습니다.

---

## 1. 강화 시트 성능/반응성 버그 수정 — ⚠️ 중요

**증상**: "비술 획득하기"(노아) / "모듈 업그레이드"(연) 시트를 열어둔 상태에서, 닫기(X) 버튼이나
터치/자동 탭 버튼을 누르는 순간 반응이 늦거나 씹히는 경우가 있었음.

**원인**: 시트가 열려있는 동안 0.2초 주기 메인 타이머가 돌 때마다(`renderHud()` → `refreshOpenModals()`)
시트 패널 **전체를 `innerHTML`로 다시 그리고 있었음**. 에너지 숫자 하나 갱신하려고 매번 닫기 버튼·탭
버튼까지 통째로 새 DOM 노드로 교체하다 보니, 하필 그 0.2초 타이밍에 사용자가 그 버튼을 누르면 누르던
노드가 그 순간 사라지면서 클릭이 유실됨.

**수정**: 두 개의 함수로 역할을 분리.

```ts
// 시트를 "열 때"와 "탭을 직접 전환할 때"만 호출 — 전체 구조를 다시 그리고 리스너도 전부 재부착.
function renderSheetContents() { /* 기존 로직 그대로: 헤더+탭+목록+버튼 전체 렌더링 */ }

// 0.2초 주기 타이머 및 구매(buy) 직후에 호출 — 닫기/탭 버튼 DOM은 절대 건드리지 않고,
// 에너지 숫자·비용·구매 가능 여부·레벨 배지 등 "실제로 바뀌는 값"만 기존 엘리먼트를 찾아 텍스트만 갱신.
function updateSheetLiveValues() {
  const panel = document.getElementById("sheetPanel");
  const energyEl = panel.querySelector(".sheet-energy");
  energyEl.textContent = formatNumber(sword.energy);
  // 탭 버튼의 <em> 레이트 텍스트만 갱신 (버튼 자체는 안 건드림)
  panel.querySelector('[data-tab="tap"] em').textContent = `${formatRate(tapPower(sword))}/회`;
  panel.querySelector('[data-tab="auto"] em').textContent = `${formatRate(autoPerSecond(sword))}/초`;
  // 각 업그레이드 행: 버튼(data-buy) 자체는 재사용하고, 안의 텍스트/클래스만 갱신
  labels.forEach((label) => {
    const btn = panel.querySelector(`[data-buy="${label.id}"]`);
    btn.classList.toggle("can", affordable);
    btn.disabled = !affordable;
    btn.querySelector(".up-name").innerHTML = `${label.name}${level > 0 ? `<em class="up-level">Lv.${level}</em>` : ""}`;
    btn.querySelector(".up-desc").textContent = `...`;
    btn.querySelector(".up-cost").textContent = formatNumber(cost);
  });
}
```

**호출부 변경**:
```ts
function refreshOpenModals() {
  if (openModal === "sheet") updateSheetLiveValues();   // 이전엔 renderSheetContents() 였음
}
// buy() 함수도 renderHud()를 통해 이 경로를 타므로 자동으로 가벼운 갱신을 사용하게 됨.
```

이 패턴(무거운 전체 렌더 vs 가벼운 값 갱신 분리)은 향후 다른 모달에서도 비슷한 "주기적 갱신 중 버튼
반응성 저하" 문제가 생기면 동일하게 적용하면 됩니다.

## 2. 업그레이드 UI 텍스트/버튼 정리

- 강화 시트 하단의 **"다른 칼 보러 가기" 링크 버튼을 완전히 삭제**했습니다. 그 버튼이 있던 `<footer
  class="sheet-foot">` 자체도, 통계 줄(`copy.hideSheetStats`가 true인 노아·연 둘 다 해당)까지 같이
  숨겨져 있는 경우엔 **footer 엘리먼트 자체를 렌더링하지 않도록** 했습니다 (빈 구분선만 남는 것 방지).

```ts
// 기존: 항상 <footer>를 렌더링하고 안에 조건부로 내용을 넣음
// 변경: 보여줄 내용이 있을 때만 <footer> 자체를 렌더링
${copy.hideSheetStats ? "" : `<footer class="sheet-foot"><p class="sheet-stats">...</p></footer>`}
```

## 3. 환경설정: "전체 사운드 조절" 슬라이더 추가

기존 BGM/터치 사운드 볼륨 위에 **마스터 볼륨** 슬라이더를 추가. 다른 두 볼륨에 곱연산으로 적용됩니다.

```ts
let masterVolume = 1;   // 0~1, storage 키: "settings:masterVolume"

function effectiveBgmVolume() { return bgmVolume * masterVolume; }
function effectiveTapVolume() { return tapVolume * masterVolume; }
```

기존에 `el.volume = bgmVolume` / `el.volume = tapVolume`로 직접 대입하던 모든 곳(게임 BGM, 타이틀
BGM, 터치 사운드 재생, 카드 해금 사운드, 피버 시작 사운드 등)을 **전부 `effectiveBgmVolume()` /
`effectiveTapVolume()` 호출로 교체**해야 합니다. 슬라이더 UI는 기존 두 슬라이더와 동일한 패턴으로
맨 위에 하나 추가하면 됩니다 (0~100 range input, `input` 이벤트에서 값 갱신 + storage 저장 + 즉시 반영).

## 4. 도감(갤러리) 버튼 아이콘 — 팀 전용 이미지로 교체

상단 HUD의 도감 버튼(기존 🃏 이모지)을 팀별 전용 책 아이콘 이미지로 교체.

```ts
const GALLERY_ICON_SRC = {
  ku: "/images/icons-gallery/gallery-icon-ku.webp",
  yu: "/images/icons-gallery/gallery-icon-yu.webp",
};
// <button id="galleryBtn"><img src={GALLERY_ICON_SRC[team]} width={24} height={24} /></button>
```

⚠️ **음소거(🔊) 버튼도 같은 방식으로 이미지 교체를 시도했었지만, 가시성이 떨어진다는 피드백으로
롤백했습니다.** 음소거 버튼은 계속 기존 🔊/🔇 이모지 그대로 두면 됩니다 — 반영하지 마세요.

## 5. 업그레이드 목록 아이콘 — 이모지 → 이미지 (팀별/항목별)

강화 시트의 각 업그레이드 항목 아이콘(기존 이모지)을 실제 이미지로 교체. 이모지 필드(`icon`)는 폴백용으로
남겨두고, `iconImg`가 있으면 이미지를 우선 사용하도록 렌더링 로직을 확장했습니다.

```ts
// 아이콘 렌더링: iconImg가 있으면 <img>, 없으면 기존 이모지
`<span class="up-icon">${label.iconImg ? `<img src="${label.iconImg}" width={30} height={30} />` : label.icon}</span>`
```

**타격(tap) 업그레이드 — 팀별로 4개 항목 전부 하나의 이미지로 통일**:

```ts
TAP_LABELS.ku[*].iconImg = "/images/icons-upgrade/tap-icon-ku-unified.webp";  // wrist/stick/glove/beast 전부 동일
TAP_LABELS.yu[*].iconImg = "/images/icons-upgrade/tap-icon-yu-unified.webp";  // wrist/stick/glove/beast 전부 동일
```

**자동(auto) 업그레이드 — 항목마다 서로 다른 이미지** (5개씩, 팀별로 완전히 다른 세트):

```ts
const AUTO_ICON_SRC = {
  ku: {
    fresh:  "/images/icons-upgrade/auto-icon-ku-fresh.webp",
    dept:   "/images/icons-upgrade/auto-icon-ku-dept.webp",
    band:   "/images/icons-upgrade/auto-icon-ku-band.webp",
    senior: "/images/icons-upgrade/auto-icon-ku-senior.webp",
    choir:  "/images/icons-upgrade/auto-icon-ku-choir.webp",
  },
  yu: {
    fresh:  "/images/icons-upgrade/auto-icon-yu-fresh.webp",
    dept:   "/images/icons-upgrade/auto-icon-yu-dept.webp",
    band:   "/images/icons-upgrade/auto-icon-yu-band.webp",
    senior: "/images/icons-upgrade/auto-icon-yu-senior.webp",
    choir:  "/images/icons-upgrade/auto-icon-yu-choir.webp",
  },
};
```

각 팀의 `id`(`fresh`/`dept`/`band`/`senior`/`choir`)와 파일명이 그대로 매칭되니 헷갈릴 일은 없을
겁니다. 노아 쪽 이미지는 붉은/일식·궤도·소용돌이·화살·검 테마, 연 쪽은 파란/사슬·번개·베기·연꽃·용
테마입니다.

---

## 자산 파일 안내 (`assets/`)

```
assets/images/
  icons-gallery/
    gallery-icon-ku.webp     도감 버튼 아이콘 — 노아
    gallery-icon-yu.webp     도감 버튼 아이콘 — 연
  icons-upgrade/
    tap-icon-ku-unified.webp     노아 타격 강화 4개 항목 공통 아이콘
    tap-icon-yu-unified.webp     연 타격 업그레이드 4개 항목 공통 아이콘
    auto-icon-ku-fresh.webp      노아 자동 타격 - 증명된 용기
    auto-icon-ku-dept.webp       노아 자동 타격 - 벼려낸 의지
    auto-icon-ku-band.webp       노아 자동 타격 - 깨어난 지혜
    auto-icon-ku-senior.webp     노아 자동 타격 - 아리아의 전설
    auto-icon-ku-choir.webp      노아 자동 타격 - 노아의 의지를 이어받은자
    auto-icon-yu-fresh.webp      연 자동 타격 시스템 - 영원의 회로
    auto-icon-yu-dept.webp       연 자동 타격 시스템 - 공명 : 온누리
    auto-icon-yu-band.webp       연 자동 타격 시스템 - 제로 : 바운더리
    auto-icon-yu-senior.webp     연 자동 타격 시스템 - 천공 : 자유의 벡터
    auto-icon-yu-choir.webp      연 자동 타격 시스템 - 연의 의지를 이어받은자
```

전부 투명 배경 WebP, 30~40px 정도로 작게 표시되는 아이콘이라 크기 걱정 없이 그대로 `public/`에
넣고 참조하면 됩니다.
