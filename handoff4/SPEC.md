# 데모 → 실제 레포 반영 스펙 (4차)

3차 핸드오프(`ky-game-handoff-3.zip`) 이후, `ky-game-preview.html` 데모에서 추가로 확정된
변경사항만 정리한 것입니다. 이전 내용은 이미 반영되었다는 전제로, 여기서는 새로 추가된 것만 다룹니다.

이 폴더 `assets/`에 이번에 확정된 아이콘 이미지 2개가 들어있습니다.

---

## 1. "+N" 점수 표시가 터치 이펙트에 가려지던 버그 수정

**증상**: 검을 터치할 때 뜨는 "+N" 점수 텍스트가, 같은 자리에 뜨는 파티클 이펙트(애니메이션 webp) 밑에
깔려서 가려지는 경우가 있었음.

**원인**: 이펙트 쪽(`.tap-effect`)에는 `z-index: 3`이 지정되어 있었는데, 점수 텍스트(`.floater`)에는
z-index가 아예 없어서(기본값 `auto`) 항상 이펙트보다 아래에 깔림.

**수정**: `.floater`에 이펙트보다 높은 `z-index: 4`를 지정.

```css
.floater { /* 기존 스타일 그대로 */ z-index: 4; }
.tap-effect { /* 기존 스타일 그대로 */ z-index: 3; }
```

## 2. 환경설정(⚙️) 버튼 아이콘 — 최종적으로 팀 공통 단일 이미지로 확정

지난 3차 이후 한 차례 "팀별 색상 톱니바퀴(노아=빨강, 연=파랑)"로 갔다가, 최종적으로 **노아·연 공통으로
흰색 톱니바퀴 아이콘 하나만** 사용하는 것으로 확정됐습니다. 팀별 분기 없이 아래 이미지 하나만 쓰면 됩니다.

```ts
const SETTINGS_ICON_SRC = "/images/icons-misc/settings-icon-unified.webp";
// <button id="settingsBtn"><img src={SETTINGS_ICON_SRC} width={22} height={22} /></button>
```

## 3. 음소거 버튼 아이콘 — 첫 화면 + 게임 내 전부 공통 이미지로 통일, 음소거 시 회색 처리

- **첫 화면(진영 선택 페이지)**의 BGM 켜기/끄기 버튼과, **게임 화면 내부**(노아·연 둘 다)의 소리
  켜기/끄기 버튼을 **똑같은 흰색 스피커 아이콘 하나로 통일**했습니다. 기존엔 각각 이모지(🔊/🔇)를
  텍스트로 바꿔치기하던 방식이었는데, 이제는 아이콘 이미지 하나를 두고 **음소거 상태일 때만 CSS 필터로
  어둡게(회색) 처리**하는 방식입니다.

```ts
const VOLUME_ICON_SRC = "/images/icons-misc/volume-icon-unified.webp";
```

```css
.volume-icon { width: 20px; height: 20px; object-fit: contain; transition: filter 0.2s ease, opacity 0.2s ease; }
/* 아이콘 자체의 잉크(스피커+음파)가 이미지 박스 안에서 기하학적 중심보다 살짝 위쪽에 몰려있어서,
   그냥 두면 위로 쏠려 보인다. 살짝 아래로 밀어서 시각적으로 중앙에 오도록 보정. */
.volume-icon { transform: translateY(1.5px); }
/* 버튼에 muted 클래스가 붙으면(음소거 상태) 회색으로 전환 */
.icon-btn.muted .volume-icon { filter: grayscale(1) brightness(0.45); opacity: 0.8; }
```

```ts
// 상태 갱신 시 textContent를 바꾸는 대신 클래스를 토글
function updateVolumeButtonState(btn: HTMLElement, isPlaying: boolean) {
  btn.classList.toggle("muted", !isPlaying);
}
```

이 아이콘/로직은 **첫 화면의 BGM 버튼**과 **게임 내 사운드 버튼**(노아·연 공통) 양쪽 모두에 동일하게
적용됩니다 — 별도 팀 분기 없이 이미지 1개, 로직 1세트로 충분합니다.

---

## 자산 파일 안내 (`assets/`)

```
assets/images/icons-misc/
  settings-icon-unified.webp   환경설정 버튼 아이콘 (노아·연 공통, 흰색 톱니바퀴)
  volume-icon-unified.webp     음소거 버튼 아이콘 (첫 화면 + 게임 내 공통, 흰색 스피커)
```

둘 다 투명 배경 WebP, 20~24px 정도로 작게 표시되는 아이콘입니다.
