# 데모 → 실제 레포 반영 스펙 (5차)

4차 핸드오프(`ky-game-handoff-4.zip`) 이후 추가된 변경사항입니다. 이번엔 **새 이미지/오디오 자산은
없고, 전부 코드(기능) 변경**이라 별도 `assets/` 폴더가 없습니다. 기존 검 이미지 등 에셋을 그대로
재사용합니다.

이번 핸드오프의 핵심은 **PIP(Picture-in-Picture) 모드** — 데스크톱 브라우저에서 화면 아무데나
작게 띄워두고 계속 플레이할 수 있는 기능입니다.

---

## 1. 터치 핵심 로직 리팩터 (`applyTap`)

PIP 모드에서도 메인 화면과 완전히 동일한 게임 규칙(콤보, 레이트리밋, 피버 게이지)이 적용되어야 해서,
기존 `handleTap()` 안에 있던 **DOM과 무관한 순수 게임 로직만** 별도 함수로 뽑아냈습니다.

```ts
/** 터치 1회의 핵심 게임 로직만 분리. 레이트리밋 걸리면 null 반환. */
function applyTap(now: number) {
  if (!sword) return null;
  tapWindow = tapWindow.filter((t) => now - t < 1000);
  if (tapWindow.length >= MAX_TAPS_PER_SECOND) return null;
  tapWindow.push(now);

  combo = now - lastTapAt <= COMBO_WINDOW_MS ? Math.min(combo + 1, COMBO_MAX) : 1;
  lastTapAt = now;

  sword = accrue(sword, now);
  const feverNow = isFeverActive(sword, now);
  const gain = tapPower(sword) * rateBonus(tapWindow.length, 1) * (feverNow ? FEVER_MULTIPLIER : 1);

  let feverGauge = sword.feverGauge;
  let feverUntil = sword.feverUntil;
  if (feverUntil <= now) {
    feverGauge = Math.min(feverGauge + 1, FEVER_MAX);
    if (feverGauge >= FEVER_MAX) { feverGauge = 0; feverUntil = now + FEVER_DURATION_MS; }
  }

  sword = { ...sword, energy: sword.energy + gain, lifetime: sword.lifetime + gain, taps: sword.taps + 1, feverGauge, feverUntil };
  dirty = true;
  return { gain, feverNow, combo };
}
```

기존 `handleTap(x, y)`는 이제 `applyTap()`을 호출한 뒤, 플로터·이펙트·사운드·진동 같은 **화면 연출만**
처리합니다. 로직 자체는 100% 동일하게 유지되었습니다(리팩터링만, 동작 변경 없음).

## 2. PIP 모드 (신규 기능)

### 2-1. 사용 기술 및 지원 범위

**Document Picture-in-Picture API**(`window.documentPictureInPicture`)를 사용합니다. 일반적인
video PiP와 달리 **임의의 HTML을 담은 떠있는 창**을 만들 수 있는 비교적 최근 API입니다.

- 지원: 데스크톱 Chrome/Edge 116+, Firefox 151+
- 미지원: Safari(전부), 모바일 브라우저 전부 → 미지원 브라우저에서는 기능 자체를 숨기고 안내 문구만 표시

```ts
const PIP_SUPPORTED = typeof window !== "undefined" && "documentPictureInPicture" in window;
let pipWindow: Window | null = null;
```

### 2-2. 진입점: 환경설정 패널

환경설정 패널을 열면 **제목 바로 아래**에 버튼이 있습니다.

```tsx
{PIP_SUPPORTED ? (
  <button onClick={togglePipMode}>{pipWindow ? "PIP 모드 끄기" : "PIP 모드로 작게 띄우기"}</button>
) : (
  <p>PIP 모드는 이 브라우저에서 지원되지 않습니다 (데스크톱 크롬·엣지·파이어폭스 최신 버전에서 사용 가능).</p>
)}
```

버튼을 누르면 설정 패널은 즉시 닫히고(`closeModal()`), PIP 토글이 진행됩니다.

### 2-3. PIP 창 열기/닫기

```ts
async function togglePipMode() {
  if (!PIP_SUPPORTED) return;
  if (pipWindow) { pipWindow.close(); return; }   // 이미 열려있으면 닫기(토글)
  try {
    const pip = await window.documentPictureInPicture.requestWindow({ width: 220, height: 300 });
    pipWindow = pip;
    // 페이지 스타일을 PIP 창(빈 문서로 시작)에 그대로 복사
    document.querySelectorAll("style").forEach((styleEl) => {
      pip.document.head.appendChild(styleEl.cloneNode(true));
    });
    pip.document.title = "고연전 응원 클리커";
    pip.document.body.style.margin = "0";
    renderPipView();
    pip.addEventListener("pagehide", () => { pipWindow = null; }, { once: true });
  } catch (e) {
    pipWindow = null;   // 사용자가 권한을 거부했거나 실패한 경우
  }
}
```

⚠️ **`requestWindow()`는 반드시 사용자 클릭(제스처) 핸들러 안에서, 그 사이에 다른 `await`가 끼지
않은 상태로 호출**해야 브라우저가 허용합니다. `togglePipMode` 자체가 클릭 핸들러에서 바로 호출되고,
그 안에서 제일 먼저 `requestWindow()`를 호출하므로 문제없습니다.

Next.js/React로 옮길 때는 `documentPictureInPicture.requestWindow()`가 리턴하는 `Window` 객체의
`document.body`에 **React 포털(`createPortal`)로 PIP 전용 컴포넌트를 렌더링**하는 방식이 더 자연스럽습니다
(React 공식 예제에도 이 패턴이 있습니다). 이 데모는 순수 JS라 `innerHTML` 직접 조작 방식을 썼지만,
실제 레포에서는 포털 방식을 권장합니다.

### 2-4. PIP 창 내부 뷰

메인 게임 화면을 그대로 옮기는 게 아니라, **PIP 전용 축소 뷰를 별도로 그립니다** (팀 배지, 에너지,
검 이미지, 터치 영역, 돌아가기 버튼만 있는 미니멀 구성).

```ts
function renderPipView() {
  if (!pipWindow || !team || !sword) return;
  const theme = TEAMS[team];
  const copy = theme.copy || {};
  const stage = stageOf(sword.lifetime);
  const swordSrc = STAGE_SWORD_B64[team]?.[stage] ? `data:image/webp;base64,${STAGE_SWORD_B64[team][stage]}` : "";
  const pd = pipWindow.document;
  pd.body.innerHTML = `
    <div class="pip-root" style="--primary:${theme.colors.primary};--accent:${theme.colors.accent};--glow:${theme.colors.glow};--bg-from:${theme.colors.bgFrom};--bg-to:${theme.colors.bgTo};">
      <header class="pip-header">
        <span class="pip-team">${copy.badgeLabel ?? `${theme.short} 공동 칼`}</span>
        <span class="pip-energy" id="pipEnergy">${formatNumber(sword.energy)}</span>
      </header>
      <button class="pip-tap-area" id="pipTapArea" aria-label="검 두드리기">
        <div class="pip-floater-layer" id="pipFloaterLayer"></div>
        ${swordSrc ? `<img class="pip-sword-img" id="pipSwordImg" src="${swordSrc}" alt="" draggable="false" />` : ""}
      </button>
      <button class="pip-return-btn" id="pipReturnBtn">원래대로 돌아가기</button>
    </div>
  `;
  pd.getElementById("pipTapArea").addEventListener("pointerdown", (e) => { e.preventDefault(); handlePipTap(); });
  pd.getElementById("pipReturnBtn").addEventListener("click", () => pipWindow.close());
}
```

- **팀 이름 표시**: "고대"/"연대"(theme.short)가 아니라 `theme.copy.badgeLabel`("노아의 검"/"연의 검")을 씁니다.
- **안내 문구("화면 아무데나 두고...") 는 넣지 않음** — 한 차례 추가했다가 삭제 확정.
- **"원래대로 돌아가기" 버튼은 반드시 창 크기·검 이미지 크기와 무관하게 하단에 고정**되어야 합니다
  (아래 2-6 레이아웃 버그 참고).

### 2-5. PIP 안에서 터치했을 때

```ts
function handlePipTap() {
  if (!pipWindow || !sword) return;
  unlockAudio();
  if (gameBgmAudio && gameBgmAudio.paused) attemptGameBgmPlay();
  const result = applyTap(Date.now());
  if (!result) return;
  renderCombo();
  playHit(result.combo, result.feverNow);
  vibrate(result.combo > 30 ? 12 : 8);
  checkStageAndFever();   // 진화/피버 등 전체 이벤트도 동일하게 트리거됨
  renderHud();            // 메인 화면(백그라운드)도 같이 갱신
  updatePipLiveValues();
  pushPipFloater("+" + formatNumber(result.gain));
}

function pushPipFloater(text: string) {
  if (!pipWindow) return;
  const layer = pipWindow.document.getElementById("pipFloaterLayer");
  const el = pipWindow.document.createElement("span");
  el.className = "pip-floater";
  el.textContent = text;
  el.style.left = `${40 + Math.random() * 20}%`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 800);
}
```

PIP 안에서의 터치는 **메인 화면과 완전히 같은 `sword` 상태 객체를 공유**하므로, 진화·피버·연마(별) 등
모든 이벤트가 동일하게 발생합니다. 다만 그 이벤트들의 "화면 연출"(진화 팝업, 피버 팝인 등)은 지금은
메인 문서에만 렌더링되므로, 메인 탭이 백그라운드에 있으면 사용자는 못 보고 넘어갑니다 — 지금은
의도적으로 단순화한 부분입니다. 필요하면 추후 "진화 발생 시 PIP 창에도 간단한 알림" 정도를 추가할 수
있습니다.

### 2-6. 실시간 값 갱신 (메인 0.2초 틱에 연동)

```ts
mainTimer = setInterval(() => {
  sword = accrue(sword);
  // ...기존 로직...
  renderHud();
  updatePipLiveValues();   // 추가된 한 줄
}, 200);

function updatePipLiveValues() {
  if (!pipWindow || !team || !sword) return;
  const pd = pipWindow.document;
  pd.getElementById("pipEnergy").textContent = formatNumber(sword.energy);
  const stage = stageOf(sword.lifetime);
  const wantedSrc = STAGE_SWORD_B64[team]?.[stage] ? `data:image/webp;base64,${STAGE_SWORD_B64[team][stage]}` : "";
  const imgEl = pd.getElementById("pipSwordImg");
  if (imgEl && wantedSrc && !imgEl.src.endsWith(wantedSrc.slice(-40))) imgEl.src = wantedSrc;
}
```

강화 시트 때와 같은 이유로, **탭 버튼/돌아가기 버튼 DOM은 절대 재생성하지 않고** 에너지 숫자와 검
이미지(src)만 갱신합니다.

## 3. PIP 레이아웃 CSS + 발견된 버그 수정

```css
.pip-root {
  position: relative; width: 100%; height: 100dvh; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: radial-gradient(120% 100% at 50% 0%, var(--bg-to), var(--bg-from)); color: #fff;
  overflow: hidden; box-sizing: border-box; padding: 10px 10px 40px;  /* 하단 40px는 돌아가기 버튼 자리 예약 */
}
.pip-header { position: absolute; top: 8px; left: 10px; right: 10px; display: flex; justify-content: space-between; }
.pip-tap-area {
  position: relative; flex: 1; min-height: 0;  /* ⚠️ 아래 버그 설명 참고 — 반드시 필요 */
  width: 100%; max-width: 160px; display: flex; align-items: center; justify-content: center;
  overflow: hidden; background: none; border: none; cursor: pointer;
}
.pip-sword-img { max-width: 62%; max-height: 60%; object-fit: contain; }
.pip-return-btn {
  position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%);  /* 레이아웃 흐름 밖, 항상 하단 고정 */
  padding: 6px 12px; border-radius: 999px; font-size: 10.5px; font-weight: 700; white-space: nowrap;
}
```

⚠️ **발견된 버그**: 1단계 검처럼 원본 이미지 비율이 다른 그림이 들어오면, "원래대로 돌아가기" 버튼이
화면 밖으로 밀려서 안 보이는 문제가 있었습니다.

**원인**: `.pip-tap-area`가 flex 아이템인데, flex 아이템은 기본적으로 `min-height: auto`라서 **내부
콘텐츠(이미지)의 실제 크기보다 작아지지 않으려는 성질**이 있습니다. 이미지 비율에 따라 이 최소 크기가
할당된 flex 공간보다 커지면 `.pip-root`의 `overflow: hidden` 때문에 그 아래 있던 버튼이 통째로 잘려서
안 보이게 됩니다.

**해결**: `.pip-tap-area`에 `min-height: 0`을 명시(고전적인 flexbox 버그 해결법)하고, `overflow: hidden`도
같이 줘서 이미지가 넘치더라도 그 안에서만 잘리게 함. 추가로 "돌아가기" 버튼은 **아예 flex 흐름에서
빼서 `position: absolute`로 하단에 고정** — 이렇게 하면 검 이미지 크기가 어떻게 되든 버튼 자리는
`.pip-root`의 `padding-bottom: 40px`로 항상 확보됩니다.
