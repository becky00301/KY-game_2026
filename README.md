# 승리의 검 — 고연전 응원 클리커

고대생 전체가 **하나의 칼**을 두드려 함께 키운다. 연대도 마찬가지로 자기 칼을 하나 갖는다.
내가 두드린 만큼 같은 편 모두의 칼이 자란다.

랭킹·닉네임·계정은 없다. 첫 화면에서 고대 / 연대만 고르면 바로 시작한다.

## 실행

```bash
npm run dev
```

http://localhost:3000 — 모바일 세로 화면 기준이다.

Supabase 자격증명이 없으면 개발용 로컬 백엔드로 돌아간다. 바로 플레이할 수 있지만
같은 컴퓨터 안에서만 공유된다.

## Supabase 연결

1. Supabase에서 프로젝트를 만든다.
2. 대시보드 > SQL Editor 에 [supabase/schema.sql](supabase/schema.sql)을 통째로 붙여넣고 실행한다.
   테이블·함수·권한·초기 데이터가 한 번에 만들어지고, 여러 번 실행해도 안전하다.
3. `.env.local.example`을 `.env.local`로 복사하고 값을 채운다.

```bash
cp .env.local.example .env.local
```

4. 개발 서버를 다시 시작한다. 콘솔이 아니라 화면 동작으로 확인하면 된다 —
   서로 다른 기기에서 접속했을 때 터치 수가 같이 오르면 연결된 것이다.

## 공유 구조

| 무엇 | 어디에 있나 |
| --- | --- |
| 칼 단계, 공동 기운, 강화 레벨, 전체 터치 수, 응원 열기 | **서버 (팀별 1행)** |
| 내가 어느 편인지, 내가 보탠 터치 수 | 내 기기 (localStorage) |

- 공동 기운은 하나의 지갑이다. 누구나 그 기운으로 강화를 살 수 있고, 강화는 모두에게 적용된다.
- 응원 열기 게이지도 팀 전체가 함께 채운다. 다 차는 순간 접속해 있는 **모두**에게 10초간 3배가 걸린다.
- 자동 응원은 매초 도는 작업 없이, 상태를 읽거나 쓸 때마다 마지막 정산 이후 흐른 시간만큼
  한 번에 반영한다. 접속자가 없어도 칼은 계속 자란다.

## 점수를 서버가 계산하는 이유

공동 칼에서는 한 명이 값을 부풀리면 학교 전체 결과가 망가진다. 그래서 클라이언트는
"몇 번 두드렸다"만 보내고, 얼마를 얻을지는 서버가 정한다.

- 획득량은 서버가 저장된 강화 레벨과 칼 단계로 직접 계산한다.
- 연타 보너스도 클라이언트가 보낸 콤보 숫자가 아니라, 서버가 실제 터치 속도로 계산한다.
- 기기당 초당 20회까지만 인정한다(`tap_budget`).
- `swords` 테이블은 읽기만 열려 있고, 변경은 `sword_get` / `sword_tap` / `sword_buy`
  세 함수로만 가능하다.

화면에 보이는 숫자는 손맛을 위해 먼저 낙관적으로 올라가고, 1초마다 서버 값으로 맞춰진다.

## 구조

```
app/
  page.tsx            팀 선택 ↔ 게임 화면
  globals.css         전체 스타일 (팀 색상은 CSS 변수로 주입)
  preview/page.tsx    개발용 — 칼 5단계를 두 팀 모두 한 화면에서 확인
  api/sword/          개발용 로컬 백엔드 (Supabase 없을 때만)
components/
  TeamSelect.tsx      고대 / 연대 선택
  GameScreen.tsx      터치·낙관적 반영·서버 동기화·연출
  UpgradeSheet.tsx    공동 강화 시트
  Sword.tsx           단계별 칼 SVG (이미지 에셋 없음)
lib/
  engine.ts           게임 수학 — 단계, 획득량, 강화 비용, 자동 정산
  backend.ts          Supabase / 로컬 백엔드 전환
  game.ts             팀 테마와 숫자 표기
  upgrades.ts         강화 이름·아이콘
  sfx.ts              WebAudio로 합성한 타격음 (음원 저작권 이슈 없음)
supabase/schema.sql   테이블·함수·권한·초기 데이터
```

### 수치를 바꿀 때

밸런스 수치는 **두 곳**에 있다. 서버가 최종 권위이므로 둘을 같이 고쳐야 한다.

- `lib/engine.ts` — `STAGE_THRESHOLDS`, `UPGRADE_NUMBERS` (화면 예측용)
- `supabase/schema.sql` — `game_config`, `upgrade_defs` (실제 계산)

Supabase를 연결한 뒤에는 `game_config` / `upgrade_defs` 행을 대시보드에서 직접 고치면
배포 없이 진행 속도를 조절할 수 있다. 행사 중에 칼이 너무 빨리 혹은 느리게 자랄 때 쓴다.

`app/preview`는 칼 디자인을 다듬을 때 쓰는 개발용 페이지다. 배포 전에 지워도 된다.

## 아직 없는 것

랭킹(개인·학과·단과대), 학과 선택, 보스 관문, 미션, 결과 공유 카드, 이메일 인증,
운영자 페이지.

## 배포 (Vercel)

1. GitHub 저장소를 만들고 푸시한다.

```bash
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

2. Vercel에서 그 저장소를 Import 한다. Next.js는 자동 인식되므로 빌드 설정은 건드리지 않아도 된다.
3. **배포 전에** Settings → Environment Variables 에 두 값을 넣는다.
   Production·Preview·Development 를 모두 체크한다.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

4. Deploy.

> `NEXT_PUBLIC_` 로 시작하는 값은 **빌드 시점에 코드에 박힌다.** 이미 배포한 뒤에 값을
> 바꾸거나 추가했다면 재시작이 아니라 **재배포(Redeploy)** 를 해야 반영된다.

환경변수 없이 배포하면 게임 대신 설정 안내 화면이 뜨고 `/api/sword/*` 는 503을 돌려준다.
개발용 로컬 백엔드가 서버리스에서 인스턴스마다 다른 칼을 만들어 조용히 깨지는 것을
막기 위한 장치다.

## 함께 작업하기

### 저장소 주인이 할 일

GitHub 저장소 → Settings → Collaborators → **Add people** 로 친구를 초대한다.
초대를 수락하면 그때부터 push 할 수 있다.

저장소는 공개라 초대 없이도 코드를 보고 클론할 수는 있지만, 고치려면 초대가 필요하다.

### 친구가 처음 할 일

```bash
git clone https://github.com/becky00301/KY-game_2026.git
cd KY-game_2026
npm install
npm run dev
```

이것만으로 바로 플레이하며 개발할 수 있다. Supabase 자격증명이 없으면
**개발용 로컬 백엔드**로 돌아가므로, 실제 행사용 칼을 건드리지 않는다.
혼자 화면을 만지고 고칠 때는 이 상태가 오히려 안전하다.

실제 공유 서버에 붙여 확인해야 할 때만 `.env.local` 을 만든다.

```bash
cp .env.local.example .env.local
```

값 두 개는 저장소에 넣지 않으므로 주인에게 따로 받는다. anon key는 브라우저에
노출되는 공개 값이라 카카오톡 등으로 전달해도 문제없다. **다만 이때는 진짜 칼을
두드리는 것이므로 실제 수치가 올라간다.**

### 서로 충돌하지 않게

둘 다 `main` 에 바로 push 하면 서로 밀어내기 쉽다. 작업은 브랜치에서 하고
GitHub에서 Pull Request로 합치는 편이 안전하다.

```bash
git switch -c 작업이름
git push -u origin 작업이름
```

Vercel은 `main` 에 push될 때마다 자동으로 재배포한다. 브랜치를 push하면
미리보기 주소가 따로 생기므로, 합치기 전에 실제 화면으로 확인할 수 있다.

친구가 push해도 배포는 주인의 Vercel 프로젝트에서 자동으로 돌아간다.
친구에게 Vercel 계정 권한을 따로 줄 필요는 없다.

### 커밋하면 안 되는 것

`.env.local` 은 `.gitignore` 에 걸려 있어 자동으로 빠진다. 실수로 키를 코드에
직접 적어 넣지만 않으면 된다. Supabase의 **service_role 키는 어디에도 넣지 않는다.**

### 스키마를 바꿀 때

`supabase/schema.sql` 을 고쳤다면 파일만 고쳐서는 반영되지 않는다.
Supabase 대시보드 SQL Editor에서 실행해야 실제로 적용된다. 둘이 각자 실행하면
꼬일 수 있으니 스키마 변경은 한 사람이 맡는 편이 낫다.

## 칼 초기화

테스트로 쌓인 수치를 0으로 되돌리려면 SQL Editor에서
[supabase/reset.sql](supabase/reset.sql)을 실행한다. 행사 시작 직전에 한 번 돌리면 된다.
테이블 구조와 `game_config` 설정은 그대로 남는다.

## 행사 전에 점검할 것

- 터치는 1초에 한 번 묶어서 보낸다. 동시 접속자 수만큼 초당 요청이 생기므로,
  행사 규모에 맞춰 `FLUSH_INTERVAL_MS`(components/GameScreen.tsx)와 Supabase 요금제를
  미리 확인한다. 접속자가 많을 것 같으면 이 값을 2~3초로 늘리는 것이 가장 손쉬운 완화책이다.
- 기기 식별값은 연타 제한 용도로만 쓰는 임의의 UUID다. 지우고 다시 들어오면 새 값이
  발급되므로 작정한 조작을 완전히 막지는 못한다. 필요하면 서버측 IP 단위 제한을 더한다.
- 실제 접속자 수로 한 번 리허설해 보고 `game_config`의 `stage_thresholds`를 조정한다.
  대시보드에서 바로 고칠 수 있어 재배포가 필요 없다.
