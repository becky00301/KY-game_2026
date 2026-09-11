# 데모 → 실제 레포 반영 스펙 (7차)

6차 핸드오프(`ky-game-handoff-6.zip`, 서휘령 입장 단계까지) 이후 추가된 변경사항입니다. 이번 핸드오프의
핵심은 **서휘령 실제 전투 시스템**이 처음으로 구현된 것입니다. 입장맵의 "입장하기" 버튼을 누르면
더 이상 "준비 중" 토스트가 뜨지 않고, 실제 전투로 진입합니다.

일러스트는 전투 배경 1장(`battle-bg.webp`)과 데스카운트 하트 아이콘(`death-count-icon.webp`)만
받았고, 나머지(콤보/HP바/패턴 예고 등)는 전부 색상·도형 위주 **플레이스홀더**입니다. 실제 일러스트가
나오면 해당 CSS/이미지 슬롯만 교체하면 되도록 구조를 잡아뒀습니다.

---

## 1. 전투 진입 흐름

```
입장맵 "입장하기" 클릭
  → 3초 암전 + "과연, 너는 얼마나 버틸 수 있을까?" 대사
  → 전투 화면 진입 (배경 battle-bg.webp)
```

```ts
const BOSS_BATTLE_INTRO_LINE = "과연, 너는 얼마나 버틸 수 있을까?";

function startBossBattle() {
  showBlackoutLine(BOSS_BATTLE_INTRO_LINE, { durationMs: 3000 });
  // 3초 후 enterBossBattleScreen() 호출
}
```

## 2. 밸런스 상수 (전부 임시값 — 플레이테스트 후 조정 권장)

```ts
const BOSS_BATTLE = {
  maxHp: 1300,                  // 기존 1000에서 30% 증가
  baseDamage: 4,
  maxCombo: 50,
  comboDecayMs: 1500,           // 이 시간 동안 안 때리면 콤보 초기화
  maxDamageMultiplier: 3,       // 콤보 50에서 데미지 300%(=+200%)
  maxDeathCount: 5,
  pattern1IntervalMs: 1600,     // 패턴1 발동 주기 (3000 → 2000 → 1600으로 두 차례 단축)
  pattern1WarnMs: 500,          // 예고(빨간 경고) 지속시간 (1000 → 650 → 500)
  pattern1ActiveMs: 650,        // 실제 피격 판정 지속시간 (1000 → 800 → 650)
  pattern1DeathPenalty: 1,
  pattern2Thresholds: [0.75, 0.5, 0.25],
  pattern2WarnMs: 1500,
  pattern2ActiveMs: 400,
  pattern2DeathPenalty: 3,
  finaleRingDurationMs: 2200,   // 발악 패턴 링이 줄어드는 총 시간
  finaleWindowMs: 500,          // 정타 판정 허용 오차(전체 폭, 앞뒤로 절반씩)
  timeLimitMs: 3 * 60 * 1000,   // 제한시간 3분 — 초과 시 자동 패배
};
```

## 3. 기본 시스템 — 콤보 & 데미지

화면 대부분을 차지하는 넓은 터치 영역(`.bb-tap-area`)을 탭하면:

```ts
function bbHandleTap(x, y) {
  // ...패턴 위험구역에 맞았는지 먼저 체크(4번 항목 참고), 아니면:
  const now = Date.now();
  combo = (now - lastTapAt <= comboDecayMs) ? Math.min(combo + 1, maxCombo) : 1;
  lastTapAt = now;
  const mult = 1 + (combo / maxCombo) * (maxDamageMultiplier - 1); // 1x ~ 3x
  hp = Math.max(0, hp - baseDamage * mult);
}
```

- 콤보는 0~50, **1.5초 안에 다시 안 때리면 0으로 초기화**(별도 폴링 타이머로 체크).
- 데미지는 콤보에 비례해 선형으로 최대 +200%까지 증가.
- HP가 0이 되면 즉시 6번(발악 패턴)으로 전환.

## 4. 패턴1 — 3분할 공격

```ts
function bbTriggerPattern1() {
  orientation = random(["vertical", "horizontal", "diagonal"]);
  dangerZones = pick 2 of [0,1,2] randomly;
  phase = "telegraph";        // 빨간 반투명 예고
  wait(pattern1WarnMs);
  phase = "active";           // 이 구간에 탭하면 피격
  wait(pattern1ActiveMs);
  phase = "idle";
}
// pattern1IntervalMs마다 반복
```

- **좌표 → 구역 판정**: 터치 영역의 `getBoundingClientRect()` 기준 정규화 좌표(0~1)로 계산.
  - 세로(`vertical`): `floor(xFrac * 3)`
  - 가로(`horizontal`): `floor(yFrac * 3)`
  - 대각선(`diagonal`): `d = xFrac + yFrac`; `d < 2/3` → 0(좌상단), `d < 4/3` → 1(중앙), 그 외 → 2(우하단)
- 대각선 시각 표현은 CSS `clip-path` 삼각형/육각형 3개로 구현(정확한 좌표는 코드의
  `.bb-zone[data-orient="diagonal"]` 참고).
- **피격 시**: 데스카운트 -1, 콤보 0으로 초기화, 화면 붉은 플래시(7번 항목).

## 5. 패턴2 — HP 임계값 전체 공격

HP가 75%/50%/25%를 각각 처음 통과하는 순간 발동(한 임계값당 1회만):

```ts
function bbTriggerPattern2() {
  // 진행 중이던 패턴1은 즉시 취소(겹침 방지, 6번 항목 참고)
  phase = "warn";   // 전체 화면 붉은 펄스 예고, 1.5초
  wait(pattern2WarnMs);
  phase = "active"; // 0.4초간 아무 곳이나 탭하면 피격
  wait(pattern2ActiveMs);
  phase = "idle";
  lastTapAt = now(); // 재개 시 콤보 유예시간을 새로 준다
}
```

- **피격 시**: 데스카운트 -3, 콤보 초기화. **단, 이 이벤트 진행 중에는 손을 떼고 있어도(=탭을 안 해도)
  1.5초 콤보 자동 초기화 타이머가 동작하지 않는다** — 강제로 멈춰야 하는 패턴 특성상 예외 처리.

## 6. 패턴 간 겹침 방지 (중요 버그 수정)

원래 두 패턴이 동시에 나오는 문제가 있었습니다. 다음 3가지를 모두 지켜야 합니다:

1. HP 임계값 체크(`bbCheckHpThresholds`) 시 **이미 패턴2가 진행 중이면 새로 발동하지 않음** — 기존엔
   패턴2의 "예고" 단계에서도 탭이 정상 처리되어 데미지가 들어가고, 그 사이 다음 임계값을 넘으면
   패턴2가 중첩 발동하는 버그가 있었음.
2. 패턴2가 시작되는 순간, 진행 중이던 패턴1 상태를 즉시 `idle`로 초기화하고 위험구역 표시를 지운다.
3. 패턴1의 예고→판정 전환 타이머가 실행될 때 `inPattern2`이면 조용히 취소(전환하지 않고 idle로 되돌림).

## 7. 패턴3 — 발악(피니시) & 타이머 & UI 세부사항

- **발악 패턴**: HP 0 도달 시 링(바깥쪽 원)이 `finaleRingDurationMs`(2.2초)에 걸쳐 지름
  260px→90px로 줄어들며 목표 링(90px 고정)에 맞춰진다. 이 시점 근방(`finaleWindowMs` 앞뒤 총
  500ms)에 특수 스킬 버튼을 눌러야 승리. **범위 밖에서 누르거나 아예 안 누르면 즉시 패배**(데스카운트
  0 처리).
- **제한시간**: 진입 시각 기준 3분 카운트다운을 HP바 옆에 표시(`M:SS`), 20초 이하부터 빨갛게 깜빡임.
  0이 되면 자동 패배 처리(사유: "시간초과").
- **화면 플래시**: 패턴1/2 피격, 발악 실패 시 → 붉은 플래시(`bb-flash-hit`). 발악 성공 시 → 흰색→청록
  플래시(`bb-flash-success`). 각각 0.35초 애니메이션, `z-index`는 HUD보다 위·결과창보다 아래.
- **데스카운트 아이콘**: 기존 이모지(♥)를 `death-count-icon.webp`로 교체. 소진된 칸은
  `opacity:0.25; filter:grayscale(1)`로 흐리게 표시.
- **검 장식**: 전투 배경 중앙에 서휘령의 검(6차 핸드오프의 `boss-map-sword.webp` 재사용, 이번엔 새
  파일 없음)을 배치하고 3.2초 주기로 ±14px 위아래로 부드럽게 떠다니는 애니메이션 추가
  (`pointer-events:none`이라 탭 판정에는 영향 없음).

---

## 자산 파일 안내 (`assets/`)

```
assets/images/boss-battle/
  battle-bg.webp            전투 화면 배경 (달빛 사찰 이미지)
  death-count-icon.webp     데스카운트에 쓰이는 하트 아이콘
```

전투 화면에 뜨는 서휘령 검 장식은 6차 핸드오프에서 전달한 `boss-map-sword.webp`를 그대로
재사용하는 것이라 이번엔 별도 포함하지 않았습니다.

## 향후 반영 필요 (플레이스홀더 상태)

- 콤보 숫자 표시, HP 게이지, 예고/판정 오버레이, 발악 링, 특수 스킬 버튼 전부 색상·도형 스타일입니다.
  실제 UI 일러스트가 나오면 해당 CSS 클래스(`.bb-hp-fill`, `.bb-zone`, `.bb-full-warning`,
  `.bb-finale-ring-*`, `.bb-skill-btn` 등)의 배경을 이미지로 교체하면 됩니다.
- 밸런스 수치(데미지, HP, 패턴 타이밍, 제한시간)는 전부 임시값이라 실제 플레이테스트 후 조정을
  권장합니다.
