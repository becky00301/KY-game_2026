-- 승리의 검 — 공동 칼 스키마
--
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행한다.
-- 여러 번 실행해도 안전하도록 작성했다.
--
-- 설계 요지
--   * 점수 계산은 전부 이 파일의 함수 안에서 일어난다. 클라이언트는 "몇 번 두드렸다"만
--     보내고, 얼마를 얻을지는 서버가 정한다.
--   * 자동 응원은 매초 돌리는 작업 없이, 상태를 읽거나 쓸 때마다
--     마지막 정산 시각 이후 흐른 시간만큼 한 번에 반영한다(sword_accrue).
--   * 테이블 직접 수정은 막고, 아래 RPC로만 상태가 바뀐다.

-- ---------- 테이블 ----------

create table if not exists public.game_config (
  id                  int primary key default 1 check (id = 1),
  stage_thresholds    numeric[] not null,
  stage_growth        numeric   not null default 1.85,
  max_taps_per_flush  int       not null default 90,
  max_taps_per_second int       not null default 30,
  max_accrual_seconds int       not null default 120,
  fever_max           numeric   not null default 3000,
  fever_duration_ms   int       not null default 10000,
  fever_multiplier    numeric   not null default 3,
  rate_bonus_per_tap  numeric   not null default 0.02,
  rate_bonus_cap      numeric   not null default 20
);

-- game_config는 이미 운영 중인 테이블이라 create table if not exists로는 새 컬럼이 추가되지
-- 않는다(테이블이 이미 있으면 그 문장 자체가 통째로 무시됨). 그래서 새 설정값은 이렇게
-- alter table ... add column if not exists로 따로 얹는다.
alter table public.game_config add column if not exists critical_chance     numeric not null default 0.1;
alter table public.game_config add column if not exists critical_multiplier numeric not null default 10;
-- 터치로 "보유 재화"(energy)에 쌓이는 몫 — 점수(lifetime)는 그대로 두고 재화만 줄일 때 쓴다.
-- 자동 응원(accrue) 수입에는 적용하지 않는다.
alter table public.game_config add column if not exists tap_currency_ratio   numeric not null default 1;

create table if not exists public.upgrade_defs (
  id        text primary key,
  kind      text    not null check (kind in ('tap', 'auto')),
  base_cost numeric not null,
  growth    numeric not null,
  power     numeric not null,
  sort      int     not null
);

-- "잠잠한 비명"/"최종오의"처럼 power 대신 크리티컬 확률·배수를 올리고, 가격도 지수가
-- 아니라 선형으로 느는 강화용 컬럼. 기존 항목은 전부 기본값(해당 없음)을 쓴다.
alter table public.upgrade_defs add column if not exists max_level             int;
alter table public.upgrade_defs add column if not exists linear_cost           boolean not null default false;
alter table public.upgrade_defs add column if not exists crit_chance_per_level numeric not null default 0;
alter table public.upgrade_defs add column if not exists crit_mult_per_level   numeric not null default 0;

create table if not exists public.swords (
  team         text primary key check (team in ('ku', 'yu')),
  energy       numeric     not null default 0,
  lifetime     numeric     not null default 0,
  taps         bigint      not null default 0,
  tap_levels   jsonb       not null default '{}'::jsonb,
  auto_levels  jsonb       not null default '{}'::jsonb,
  fever_gauge  numeric     not null default 0,
  fever_until  timestamptz not null default 'epoch',
  updated_at   timestamptz not null default now()
);

-- 칼 상태가 바뀔 때마다 1씩 오르는 번호. 응답·실시간 알림이 뒤섞여 늦게 도착해도
-- 클라이언트가 더 오래된 상태로 되돌아가지 않도록 비교하는 데 쓴다.
alter table public.swords add column if not exists version bigint not null default 0;

-- 기기별 연타 제한용. 계정이 아니라 단순 식별값이다.
create table if not exists public.tap_budget (
  client_id    uuid primary key,
  window_start timestamptz not null default now(),
  taps         int         not null default 0
);

-- 연타 제한을 "1초 고정 창"에서 "토큰 통"으로 바꾸며 추가한 컬럼.
-- 고정 창에서는 1초 간격 전송이 네트워크 지연으로 0.98초 만에 도착하면 그 묶음이 통째로
-- 버려져, 화면엔 오른 재화가 서버엔 없어서 구매가 실패했다.
alter table public.tap_budget add column if not exists tokens      numeric;
alter table public.tap_budget add column if not exists refilled_at timestamptz not null default now();

-- 기기별 분당 터치 기록. 누가 얼마나 넣었는지 남겨둬야 이상한 기기를 찾아내고, 사고가 나도
-- 전체를 날리는 대신 그 기기 몫만 빼낼 수 있다. 1분에 기기당 한 줄이라 부담이 적다.
create table if not exists public.tap_log (
  client_id uuid        not null,
  minute    timestamptz not null,
  taps      int         not null default 0,
  primary key (client_id, minute)
);

-- 어느 팀에 넣었는지도 같이 남긴다(차단 판단과 사후 정정에 쓴다).
alter table public.tap_log add column if not exists team text;

create index if not exists tap_log_minute_idx on public.tap_log (minute desc);

-- 관리자 페이지(/admin)가 기기별 기록을 볼 때 쓰는 열쇠. 기본값은 반드시 바꿔서 쓴다.
alter table public.game_config add column if not exists admin_key text not null default 'change-me';

-- 운영자가 /admin에서 보내는 전체 공지. notice_at이 바뀔 때만 Realtime UPDATE 이벤트가
-- 나가므로, 지금 접속 중인 사람에게만 한 번씩 토스트로 뜬다(새로고침해서 다시 들어온
-- 사람에게 과거 공지가 다시 뜨지는 않는다).
alter table public.game_config add column if not exists notice_text text not null default '';
alter table public.game_config add column if not exists notice_at   timestamptz not null default 'epoch';

-- "함성" — 재화를 써서 화면 전체에 문구를 띄우는 기능의 가격.
alter table public.game_config add column if not exists shout_cost numeric not null default 100000;

-- 운영자가 강화 기록을 전부 초기화하고 싶을 때(테스트 데이터 정리 등) 이 값을 now()로
-- 올려두면, 접속하는 모든 기기가 자신의 강화 관련 로컬 데이터(개인 재화·기기별 점수·
-- 닉네임 캐시)를 전부 지운다. 서버 쪽 enhance_players·enhance_milestones는 운영자가
-- SQL로 직접 비워야 한다(delete from public.enhance_players; delete from
-- public.enhance_milestones;).
alter table public.game_config add column if not exists enhance_reset_at timestamptz not null default 'epoch';

create or replace function public.enhance_reset_at()
returns timestamptz language sql stable security definer set search_path = public as $$
  select enhance_reset_at from public.game_config where id = 1;
$$;

grant execute on function public.enhance_reset_at() to anon, authenticated;

-- "함성"을 쓸 때마다 기기별 마지막 사용 시각을 남긴다. 제한을 걸진 않지만, 나중에
-- 기기별 사용 빈도를 들여다봐야 할 때를 위한 기록이다.
create table if not exists public.shout_log (
  client_id     uuid primary key,
  last_shout_at timestamptz not null default 'epoch'
);

-- 실제로 화면에 뜬 "함성" 기록. 클라이언트는 이 테이블의 INSERT를 Realtime으로 받아
-- 화면에 띄운다 — 지금 접속 중인 사람에게만, 새로고침해서 들어온 사람에게는 과거 함성이
-- 다시 뜨지 않는다(swords/game_config와 같은 이유).
create table if not exists public.shouts (
  id         bigint generated always as identity primary key,
  team       text not null check (team in ('ku', 'yu')),
  nickname   text not null,
  text       text not null,
  created_at timestamptz not null default now()
);

-- 매크로로 판단된 기기. 여기 들어오면 터치가 하나도 인정되지 않는다(화면은 그대로 돌아간다).
create table if not exists public.tap_blocklist (
  client_id  uuid primary key,
  reason     text,
  blocked_at timestamptz not null default now()
);

-- ---------- 초기값 ----------

insert into public.game_config (id, stage_thresholds, stage_growth, max_taps_per_flush, max_taps_per_second, critical_chance, critical_multiplier, fever_max, tap_currency_ratio, shout_cost)
values (1, array[0, 15000, 400000, 56000000, 525000000]::numeric[], 1.85, 45, 15, 0.1, 10, 3000, 0.5, 100000)
on conflict (id) do update set
  stage_thresholds = excluded.stage_thresholds,
  stage_growth = excluded.stage_growth,
  max_taps_per_flush = excluded.max_taps_per_flush,
  max_taps_per_second = excluded.max_taps_per_second,
  critical_chance = excluded.critical_chance,
  critical_multiplier = excluded.critical_multiplier,
  fever_max = excluded.fever_max,
  tap_currency_ratio = excluded.tap_currency_ratio,
  shout_cost = excluded.shout_cost;

insert into public.upgrade_defs (id, kind, base_cost, growth, power, sort, max_level, linear_cost, crit_chance_per_level, crit_mult_per_level) values
  ('wrist',    'tap',      105, 1.14,    0.5, 1, null, false, 0,    0),
  ('stick',    'tap',     2100, 1.15,    4,   2, null, false, 0,    0),
  ('glove',    'tap',    30000, 1.16,   27.5, 3, null, false, 0,    0),
  ('beast',    'tap',   450000, 1.17,  100,   4, null, false, 0,    0),
  ('ultimate', 'tap', 10000000, 1,       0,   5, 10,   true,  0.01, 0.1),
  ('fresh',    'auto',     540, 1.14, 0.375, 1, null, false, 0,    0),
  ('dept',     'auto',    7200, 1.15,    3,   2, null, false, 0,    0),
  ('band',     'auto',   90000, 1.15,   22.5, 3, null, false, 0,    0),
  ('senior',   'auto', 1200000, 1.16,  162.5, 4, null, false, 0,    0),
  ('choir',    'auto',15000000, 1.17, 1125,   5, null, false, 0,    0)
on conflict (id) do update set
  kind = excluded.kind,
  base_cost = excluded.base_cost,
  growth = excluded.growth,
  power = excluded.power,
  sort = excluded.sort,
  max_level = excluded.max_level,
  linear_cost = excluded.linear_cost,
  crit_chance_per_level = excluded.crit_chance_per_level,
  crit_mult_per_level = excluded.crit_mult_per_level;

insert into public.swords (team) values ('ku'), ('yu')
on conflict (team) do nothing;

-- ---------- 파생 계산 ----------

create or replace function public.sword_stage(p_lifetime numeric)
returns int language sql stable as $$
  select coalesce(max(i - 1), 0)
  from public.game_config c,
       unnest(c.stage_thresholds) with ordinality as t(threshold, i)
  where p_lifetime >= t.threshold;
$$;

create or replace function public.sword_stage_mult(p_lifetime numeric)
returns numeric language sql stable as $$
  select c.stage_growth ^ public.sword_stage(p_lifetime) from public.game_config c;
$$;

create or replace function public.sword_tap_power(p_sword public.swords)
returns numeric language sql stable as $$
  select (1 + coalesce(sum(d.power * coalesce((p_sword.tap_levels ->> d.id)::numeric, 0)), 0))
         * public.sword_stage_mult(p_sword.lifetime)
  from public.upgrade_defs d
  where d.kind = 'tap';
$$;

create or replace function public.sword_auto_rate(p_sword public.swords)
returns numeric language sql stable as $$
  select coalesce(sum(d.power * coalesce((p_sword.auto_levels ->> d.id)::numeric, 0)), 0)
         * public.sword_stage_mult(p_sword.lifetime)
  from public.upgrade_defs d
  where d.kind = 'auto';
$$;

-- max_level에 닿았으면 null(더 못 산다). linear_cost면 1배,2배,3배..로, 아니면 기존처럼
-- 지수(growth^level)로 가격을 매긴다.
create or replace function public.sword_upgrade_cost(p_id text, p_level numeric)
returns numeric language sql stable as $$
  select case
    when d.max_level is not null and p_level >= d.max_level then null
    when d.linear_cost then ceil(d.base_cost * (p_level + 1))
    else ceil(d.base_cost * (d.growth ^ p_level))
  end
  from public.upgrade_defs d where d.id = p_id;
$$;

-- 팀의 크리티컬 확률 — "잠잠한 비명"/"최종오의" 레벨당 보너스를 기본 확률에 더한다.
create or replace function public.sword_critical_chance(p_sword public.swords)
returns numeric language sql stable as $$
  select (select critical_chance from public.game_config where id = 1)
       + coalesce(sum(d.crit_chance_per_level * coalesce((p_sword.tap_levels ->> d.id)::numeric, 0)), 0)
  from public.upgrade_defs d
  where d.kind = 'tap';
$$;

-- 팀의 크리티컬 배수 — 레벨당 보너스 비율만큼 기본 배수에 곱한다.
create or replace function public.sword_critical_multiplier(p_sword public.swords)
returns numeric language sql stable as $$
  select (select critical_multiplier from public.game_config where id = 1)
       * (1 + coalesce(sum(d.crit_mult_per_level * coalesce((p_sword.tap_levels ->> d.id)::numeric, 0)), 0))
  from public.upgrade_defs d
  where d.kind = 'tap';
$$;

-- ---------- 상태 전이 ----------

-- 마지막 정산 이후 흐른 시간만큼 자동 응원을 반영한다.
create or replace function public.sword_accrue(p_team text)
returns public.swords language plpgsql as $$
declare
  s       public.swords;
  cfg     public.game_config;
  elapsed numeric;
  mult    numeric;
  gain    numeric;
begin
  select * into cfg from public.game_config where id = 1;
  select * into s from public.swords where team = p_team for update;
  if not found then
    raise exception '알 수 없는 팀: %', p_team;
  end if;

  elapsed := least(greatest(extract(epoch from (now() - s.updated_at)), 0), cfg.max_accrual_seconds);
  mult := case when s.fever_until > now() then cfg.fever_multiplier else 1 end;
  gain := public.sword_auto_rate(s) * elapsed * mult;

  update public.swords
     set energy = energy + gain,
         lifetime = lifetime + gain,
         updated_at = now(),
         version = version + 1
   where team = p_team
   returning * into s;

  return s;
end;
$$;

-- 기기별 초당 상한을 적용해 실제로 인정할 터치 수를 정한다.
--
-- 토큰 통 방식: 초당 max_taps_per_second 개씩 채워지고, 최대 max_taps_per_flush 개까지
-- 쌓인다. 길게 보면 초당 상한은 그대로지만, 전송 간격이 조금 흔들리거나 구매 직전에
-- 한 번 더 보내도 정상 터치가 버려지지 않는다.
create or replace function public.sword_allow_taps(p_client uuid, p_taps int, p_team text default null)
returns int language plpgsql as $$
declare
  cfg     public.game_config;
  b       public.tap_budget;
  cap     numeric;
  tokens  numeric;
  granted int;
begin
  select * into cfg from public.game_config where id = 1;

  -- 차단된 기기는 아무것도 인정하지 않는다.
  if exists (select 1 from public.tap_blocklist where client_id = p_client) then
    return 0;
  end if;

  cap := greatest(cfg.max_taps_per_flush, cfg.max_taps_per_second);

  select * into b from public.tap_budget where client_id = p_client for update;

  if not found or b.tokens is null then
    tokens := cap;
  else
    tokens := least(cap, b.tokens
      + greatest(extract(epoch from (now() - b.refilled_at)), 0) * cfg.max_taps_per_second);
  end if;

  granted := greatest(0, least(p_taps, floor(tokens)::int));

  insert into public.tap_budget (client_id, window_start, taps, tokens, refilled_at)
  values (p_client, now(), granted, tokens - granted, now())
  on conflict (client_id) do update
    set tokens = excluded.tokens, refilled_at = excluded.refilled_at;

  -- 기기별 분당 기록 — 이상 탐지와 사후 정정에 쓴다.
  if granted > 0 then
    insert into public.tap_log (client_id, minute, taps, team)
    values (p_client, date_trunc('minute', now()), granted, p_team)
    on conflict (client_id, minute) do update
      set taps = public.tap_log.taps + excluded.taps,
          team = coalesce(excluded.team, public.tap_log.team);
  end if;

  return granted;
end;
$$;

create or replace function public.sword_row_json(s public.swords)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'team', s.team,
    'energy', s.energy,
    'lifetime', s.lifetime,
    'taps', s.taps,
    'tap_levels', s.tap_levels,
    'auto_levels', s.auto_levels,
    'fever_gauge', s.fever_gauge,
    'fever_until', (extract(epoch from s.fever_until) * 1000)::bigint,
    'updated_at', (extract(epoch from s.updated_at) * 1000)::bigint,
    'version', s.version,
    'stage', public.sword_stage(s.lifetime),
    'tap_power', public.sword_tap_power(s),
    'auto_rate', public.sword_auto_rate(s)
  );
$$;

-- ---------- RPC ----------

create or replace function public.sword_get(p_team text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.swords;
begin
  s := public.sword_accrue(p_team);
  return public.sword_row_json(s);
end;
$$;

create or replace function public.sword_tap(p_team text, p_client uuid, p_taps int, p_elapsed numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s           public.swords;
  cfg         public.game_config;
  granted     int;
  bonus       numeric;
  mult        numeric;
  gain        numeric;
  gauge       numeric;
  until       timestamptz;
  units       numeric;
  i           int;
  crit_chance numeric;
  crit_mult   numeric;
begin
  select * into cfg from public.game_config where id = 1;

  granted := public.sword_allow_taps(p_client, p_taps, p_team);
  s := public.sword_accrue(p_team);

  if granted <= 0 then
    return public.sword_row_json(s);
  end if;

  -- 크리티컬(기본 확률·배수에 "잠잠한 비명"/"최종오의" 레벨당 보너스를 더한 값)을 터치
  -- 개수만큼 각각 따로 굴려서 합산한다. 클라이언트의 낙관적 예측도 터치 1회 단위로 같은
  -- 확률을 굴리므로(lib/engine.ts의 rollCritical), 정확히 같은 결과는 아니어도 평균적으로는
  -- 같은 기댓값으로 수렴한다.
  crit_chance := public.sword_critical_chance(s);
  crit_mult := public.sword_critical_multiplier(s);
  units := 0;
  for i in 1..granted loop
    if random() < crit_chance then
      units := units + crit_mult;
    else
      units := units + 1;
    end if;
  end loop;

  -- 연타 보너스는 클라이언트가 보낸 콤보가 아니라 실제 터치 속도로 계산한다.
  bonus := 1 + least(granted / greatest(coalesce(p_elapsed, 1), 0.5), cfg.rate_bonus_cap)
               * cfg.rate_bonus_per_tap;
  mult := case when s.fever_until > now() then cfg.fever_multiplier else 1 end;
  gain := public.sword_tap_power(s) * units * bonus * mult;

  gauge := s.fever_gauge;
  until := s.fever_until;
  -- 응원 열기는 팀 전체가 함께 채우고, 차는 순간 모두에게 발동한다.
  if until <= now() then
    gauge := gauge + granted;
    if gauge >= cfg.fever_max then
      gauge := 0;
      until := now() + (cfg.fever_duration_ms || ' milliseconds')::interval;
    end if;
  end if;

  -- 점수(lifetime)는 그대로, 재화(energy)만 tap_currency_ratio만큼 줄여서 쌓는다.
  update public.swords
     set energy = energy + gain * cfg.tap_currency_ratio,
         lifetime = lifetime + gain,
         taps = taps + granted,
         fever_gauge = gauge,
         fever_until = until,
         updated_at = now(),
         version = version + 1
   where team = p_team
   returning * into s;

  return public.sword_row_json(s);
end;
$$;

create or replace function public.sword_buy(p_team text, p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s     public.swords;
  d     public.upgrade_defs;
  lvl   numeric;
  cost  numeric;
begin
  select * into d from public.upgrade_defs where id = p_id;
  if not found then
    s := public.sword_accrue(p_team);
    return jsonb_build_object('ok', false, 'reason', 'unknown-upgrade', 'sword', public.sword_row_json(s));
  end if;

  s := public.sword_accrue(p_team);

  if d.kind = 'tap' then
    lvl := coalesce((s.tap_levels ->> p_id)::numeric, 0);
  else
    lvl := coalesce((s.auto_levels ->> p_id)::numeric, 0);
  end if;

  cost := public.sword_upgrade_cost(p_id, lvl);

  -- cost가 null이면 max_level에 닿아 더 못 사는 상태 — 바로 반환한다(null과 비교하면
  -- 항상 false라 아래 insufficient 체크를 그냥 통과해버리므로 따로 걸러야 한다).
  if cost is null then
    return jsonb_build_object('ok', false, 'reason', 'max-level', 'sword', public.sword_row_json(s));
  end if;

  if s.energy < cost then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'sword', public.sword_row_json(s));
  end if;

  if d.kind = 'tap' then
    update public.swords
       set energy = energy - cost,
           tap_levels = jsonb_set(tap_levels, array[p_id], to_jsonb(lvl + 1), true),
           updated_at = now(),
           version = version + 1
     where team = p_team
     returning * into s;
  else
    update public.swords
       set energy = energy - cost,
           auto_levels = jsonb_set(auto_levels, array[p_id], to_jsonb(lvl + 1), true),
           updated_at = now(),
           version = version + 1
     where team = p_team
     returning * into s;
  end if;

  return jsonb_build_object('ok', true, 'sword', public.sword_row_json(s));
end;
$$;

-- ---------- 관리자용 조회 ----------
--
-- tap_log는 밖에서 직접 읽을 수 없으므로(RLS), 열쇠를 아는 사람만 집계를 볼 수 있게 한다.
-- 열쇠는 game_config.admin_key에 있다.
create or replace function public.admin_tap_stats(p_key text, p_minutes int default 10)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key   text;
  v_since timestamptz;
begin
  select admin_key into v_key from public.game_config where id = 1;
  if p_key is null or v_key is null or p_key <> v_key then
    return '[]'::jsonb;
  end if;

  -- p_minutes가 0 이하면 전체 기간(행사 시작부터 지금까지)을 본다.
  v_since := case
    when coalesce(p_minutes, 10) <= 0 then '-infinity'::timestamptz
    else now() - make_interval(mins => least(p_minutes, 10080))
  end;

  return coalesce((
    select jsonb_agg(row order by (row->>'taps')::int desc)
    from (
      select jsonb_build_object(
        'client_id', l.client_id,
        'taps', sum(l.taps),
        'minutes', count(*),
        'per_second', round(sum(l.taps)::numeric / greatest(count(*), 1) / 60, 1),
        'team', max(l.team),
        'last_seen', (extract(epoch from max(l.minute)) * 1000)::bigint,
        'blocked', exists (select 1 from public.tap_blocklist b where b.client_id = l.client_id)
      ) as row
      from public.tap_log l
      where l.minute > v_since
      group by l.client_id
      order by sum(l.taps) desc
      limit 100
    ) t
  ), '[]'::jsonb);
end;
$$;

-- 운영자가 /admin에서 전체 공지를 보낸다. notice_at을 now()로 갱신해야 game_config
-- Realtime UPDATE 이벤트가 나가고, 접속 중인 클라이언트가 그걸 받아 토스트로 띄운다.
create or replace function public.admin_set_notice(p_key text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  select admin_key into v_key from public.game_config where id = 1;
  if p_key is null or v_key is null or p_key <> v_key then
    return jsonb_build_object('ok', false, 'reason', 'bad-key');
  end if;

  update public.game_config set notice_text = coalesce(p_text, ''), notice_at = now() where id = 1;
  return jsonb_build_object('ok', true);
end;
$$;

-- "함성" — 재화를 써서 화면 전체에 문구를 띄운다. 기기별 제한은 없고, 전역으로 마지막
-- 함성 이후 10초가 지나야 한다(겹쳐 보이지 않게 — 같은 기기도 포함). pg_advisory_xact_lock으로
-- 동시 요청이 쿨다운 체크를 동시에 통과하는 경합을 막는다 — 그래서 거의 동시에 여러 명이
-- 쓰려 해도 한 명만 성공하고, 나머지는 10초 뒤에나 다시 시도해 자연히 순차적으로 화면에 뜬다.
create or replace function public.shout_post(p_team text, p_client uuid, p_nickname text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg        public.game_config;
  s          public.swords;
  last_any   timestamptz;
  v_nickname text := trim(coalesce(p_nickname, ''));
  v_text     text := trim(coalesce(p_text, ''));
begin
  perform pg_advisory_xact_lock(hashtext('shout_post'));

  if v_nickname = '' or char_length(v_nickname) > 14 or v_text = '' or char_length(v_text) > 30 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into cfg from public.game_config where id = 1;

  select max(created_at) into last_any from public.shouts;
  if last_any is not null and now() - last_any < interval '10 seconds' then
    return jsonb_build_object('ok', false, 'reason', 'global-cooldown');
  end if;

  s := public.sword_accrue(p_team);
  if s.energy < cfg.shout_cost then
    return jsonb_build_object('ok', false, 'reason', 'insufficient');
  end if;

  update public.swords
     set energy = energy - cfg.shout_cost,
         updated_at = now(),
         version = version + 1
   where team = p_team;

  insert into public.shout_log (client_id, last_shout_at) values (p_client, now())
    on conflict (client_id) do update set last_shout_at = excluded.last_shout_at;

  insert into public.shouts (team, nickname, text) values (p_team, v_nickname, v_text);

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- 권한 ----------

alter table public.swords       enable row level security;
alter table public.game_config  enable row level security;
alter table public.upgrade_defs enable row level security;
alter table public.tap_budget   enable row level security;
alter table public.tap_log      enable row level security;
alter table public.tap_blocklist enable row level security;
alter table public.shout_log    enable row level security;
alter table public.shouts       enable row level security;

-- 읽기만 열어 준다. 쓰기는 위 security definer 함수로만 가능하다.
drop policy if exists "swords readable" on public.swords;
create policy "swords readable" on public.swords for select using (true);

drop policy if exists "config readable" on public.game_config;
create policy "config readable" on public.game_config for select using (true);

drop policy if exists "defs readable" on public.upgrade_defs;
create policy "defs readable" on public.upgrade_defs for select using (true);
-- tap_budget·shout_log는 정책을 두지 않는다 = 클라이언트에서 직접 접근 불가.

drop policy if exists "shouts readable" on public.shouts;
create policy "shouts readable" on public.shouts for select using (true);

grant execute on function public.sword_get(text)                          to anon, authenticated;
grant execute on function public.sword_tap(text, uuid, int, numeric)      to anon, authenticated;
grant execute on function public.sword_buy(text, text)                    to anon, authenticated;
grant execute on function public.admin_tap_stats(text, int)               to anon, authenticated;
grant execute on function public.admin_set_notice(text, text)             to anon, authenticated;
grant execute on function public.shout_post(text, uuid, text, text)       to anon, authenticated;

-- 다른 사람이 두드린 결과를 실시간으로 받기 위해 swords 테이블을 Realtime에 올린다.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'swords'
  ) then
    alter publication supabase_realtime add table public.swords;
  end if;
end
$$;

-- "함성" 기록(shouts)을 실시간으로 받기 위해 올린다 — INSERT만 쓰므로 클라이언트는
-- 새로 추가되는 행만 받아본다.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shouts'
  ) then
    alter publication supabase_realtime add table public.shouts;
  end if;
end
$$;

-- 운영자 전체 공지(notice_text/notice_at)를 실시간으로 받기 위해 game_config도 올린다.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_config'
  ) then
    alter publication supabase_realtime add table public.game_config;
  end if;
end
$$;

-- ---------- 서휘령 보스전 "랭킹모드" 순위표 ----------
--
-- 서휘령(2페이즈) 격파 순서를 기록한다. 별도 계정 시스템이 없어 닉네임 자체가
-- 식별자다 — 대소문자 구분 없이 전역에서 유일해야 한다(lower(nickname) 유니크
-- 인덱스). 순위는 cleared_at 오름차순(= 클리어한 순서) 그대로다. 클라이언트는
-- 테이블에 직접 접근하지 않고 아래 security definer 함수로만 읽고 쓴다.

create table if not exists public.boss_rankings (
  id         bigint generated always as identity primary key,
  nickname   text        not null check (char_length(trim(nickname)) between 1 and 14),
  cleared_at timestamptz not null default now()
);

create unique index if not exists boss_rankings_nickname_lower_idx
  on public.boss_rankings (lower(nickname));

-- 로그인이 없는 만큼, "격파 신고"를 직접 호출해서 가짜 기록을 남기는 걸 막기 위한
-- 최소한의 장치. 전투 시작 시 서버가 1회용 토큰을 발급해 시각을 찍어 두고,
-- 격파 등록 시 그 토큰 + 최소 경과시간(아래 boss_ranking_submit)을 같이 검증한다.
-- 완전한 부정 방지는 아니지만(클라이언트만 있는 게임이라 근본적 한계가 있다),
-- 최소한 "닉네임 하나만 보내서 즉시 등록"은 막는다.
create table if not exists public.boss_ranking_sessions (
  token      uuid        primary key default gen_random_uuid(),
  nickname   text        not null,
  started_at timestamptz not null default now(),
  used       boolean     not null default false
);

-- 한 기기가 닉네임만 바꿔 순위표를 독식하는 걸 막는다. 기기 식별값(연타 제한에 쓰는 것과 같은
-- 임의 UUID)당 한 자리만 등록할 수 있다. 브라우저 데이터를 지우면 새 값이 발급되므로 완벽하진
-- 않지만, 반복 등록의 비용을 크게 올린다.
alter table public.boss_rankings         add column if not exists device_id uuid;
alter table public.boss_ranking_sessions add column if not exists device_id uuid;

create unique index if not exists boss_rankings_device_idx
  on public.boss_rankings (device_id) where device_id is not null;

create or replace function public.boss_ranking_row_json(p_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nickname', r.nickname,
    'rank', (select count(*) + 1 from public.boss_rankings o where o.cleared_at < r.cleared_at),
    'cleared_at', (extract(epoch from r.cleared_at) * 1000)::bigint
  )
  from public.boss_rankings r
  where r.id = p_id;
$$;

-- 닉네임이 아직 아무도 안 쓰고 있는지(대소문자 무시).
create or replace function public.boss_ranking_check(p_nickname text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(char_length(trim(p_nickname)), 0) between 1 and 14
     and not exists (
       select 1 from public.boss_rankings where lower(nickname) = lower(trim(p_nickname))
     );
$$;

-- 입장 전 확인 — 닉네임 형식·중복과 "이 기기가 이미 등록했는지"를 한 번에 본다.
create or replace function public.boss_ranking_can_enter(p_nickname text, p_device uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_nickname text := trim(p_nickname);
begin
  if char_length(v_nickname) < 1 or char_length(v_nickname) > 14 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_device is not null and exists (select 1 from public.boss_rankings where device_id = p_device) then
    return jsonb_build_object('ok', false, 'reason', 'device_taken');
  end if;
  if exists (select 1 from public.boss_rankings where lower(nickname) = lower(v_nickname)) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 기기 식별값을 같이 받도록 바뀌었으니 옛 시그니처는 지운다(두면 기기 제한을 우회할 수 있다).
drop function if exists public.boss_ranking_start(text);

-- 랭킹모드 전투를 실제로 시작할 때(닉네임 확정 직후) 한 번 호출 — 1회용 토큰을 발급한다.
create or replace function public.boss_ranking_start(p_nickname text, p_device uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nickname text := trim(p_nickname);
  v_token    uuid;
begin
  if char_length(v_nickname) < 1 or char_length(v_nickname) > 14 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_device is not null and exists (select 1 from public.boss_rankings where device_id = p_device) then
    return jsonb_build_object('ok', false, 'reason', 'device_taken');
  end if;

  insert into public.boss_ranking_sessions (nickname, device_id)
  values (v_nickname, p_device)
  returning token into v_token;

  return jsonb_build_object('ok', true, 'token', v_token);
end;
$$;

-- 이전 시그니처(토큰 없음)가 남아있으면 그대로 호출 가능해 방어가 무의미해지므로 명시적으로 지운다.
drop function if exists public.boss_ranking_submit(text);

-- 격파 순간 한 번 호출 — 발급받은 토큰이 그 닉네임의 것이고, 아직 안 쓴 채로,
-- 시작한 지 최소 60초는 지나야 등록된다. 이미 등록된(경합 포함) 닉네임이면
-- ok:false, reason:'taken'.
create or replace function public.boss_ranking_submit(p_nickname text, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nickname text := trim(p_nickname);
  v_id       bigint;
  v_session  public.boss_ranking_sessions;
begin
  if char_length(v_nickname) < 1 or char_length(v_nickname) > 14 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_session from public.boss_ranking_sessions
   where token = p_token and lower(nickname) = lower(v_nickname)
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;
  if v_session.used then
    return jsonb_build_object('ok', false, 'reason', 'session_used');
  end if;
  if now() - v_session.started_at < interval '60 seconds' then
    return jsonb_build_object('ok', false, 'reason', 'too_fast');
  end if;

  -- 이 기기가 이미 한 자리를 차지하고 있으면 더 등록할 수 없다.
  if v_session.device_id is not null
     and exists (select 1 from public.boss_rankings where device_id = v_session.device_id) then
    return jsonb_build_object('ok', false, 'reason', 'device_taken');
  end if;

  update public.boss_ranking_sessions set used = true where token = p_token;

  insert into public.boss_rankings (nickname, device_id)
  values (v_nickname, v_session.device_id)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;

  return jsonb_build_object('ok', true) || public.boss_ranking_row_json(v_id);
end;
$$;

create or replace function public.boss_ranking_top(p_limit int default 10)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row), '[]'::jsonb) from (
    select jsonb_build_object(
      'nickname', nickname,
      'rank', row_number() over (order by cleared_at asc),
      'cleared_at', (extract(epoch from cleared_at) * 1000)::bigint
    ) as row
    from public.boss_rankings
    order by cleared_at asc
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ) t;
$$;

create or replace function public.boss_ranking_mine(p_nickname text)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.boss_ranking_row_json(id)
  from public.boss_rankings
  where lower(nickname) = lower(trim(p_nickname))
  limit 1;
$$;

-- 직접 테이블 접근은 막는다(select 정책 없음) — 전부 위 함수로만 읽고 쓴다.
alter table public.boss_rankings enable row level security;
alter table public.boss_ranking_sessions enable row level security;

grant execute on function public.boss_ranking_check(text)       to anon, authenticated;
grant execute on function public.boss_ranking_can_enter(text, uuid) to anon, authenticated;
grant execute on function public.boss_ranking_start(text, uuid) to anon, authenticated;
grant execute on function public.boss_ranking_submit(text, uuid) to anon, authenticated;
grant execute on function public.boss_ranking_top(int)           to anon, authenticated;
grant execute on function public.boss_ranking_mine(text)         to anon, authenticated;

--
-- "강화" 미니게임 — 기기별 개인 재화(염원의 빛/데이터로그)로 노아는 아리아의 옥을,
-- 연은 리버티 오브 페더를 0~30단계까지 강화한다. 재화 차감·성공확률 굴림은 전부
-- 클라이언트에서 계산한다(계정 시스템이 없는 캐주얼 게임이라 contrib와 같은 신뢰
-- 모델 — 완벽한 부정 방지는 하지 않는다). 서버에는 랭킹에 필요한 닉네임·현재 단계만
-- 올라간다. 두 팀은 사실상 서로 다른 아이템을 강화하는 별개의 게임이라, 기기 하나가
-- 팀별로 각각 한 자리씩 가질 수 있고(device_id+team 복합키), 닉네임도 "전역 유일"이
-- 아니라 "같은 팀 안에서만 유일"하다 — 같은 사람이 양쪽 팀에 같은 닉네임을 써도 된다.

create table if not exists public.enhance_players (
  device_id  uuid        not null,
  team       text        not null default 'ku' check (team in ('ku', 'yu')),
  nickname   text        not null check (char_length(trim(nickname)) between 1 and 14),
  level      int         not null default 0 check (level between 0 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 예전엔 device_id 하나가 기본키라 기기당 팀 구분 없이 한 자리뿐이었다. 이제 노아·연
-- 둘 다 강화가 가능해서, 같은 기기도 팀별로 따로 한 자리씩 가져야 한다.
alter table public.enhance_players drop constraint if exists enhance_players_pkey;
alter table public.enhance_players add primary key (device_id, team);

drop index if exists enhance_players_nickname_lower_idx;
create unique index if not exists enhance_players_team_nickname_lower_idx
  on public.enhance_players (team, lower(nickname));

-- 닉네임이 그 팀 안에서 아직 아무도 안 쓰고 있는지(대소문자 무시).
drop function if exists public.enhance_nickname_check(text);
create or replace function public.enhance_nickname_check(p_nickname text, p_team text default 'ku')
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(char_length(trim(p_nickname)), 0) between 1 and 14
     and not exists (
       select 1 from public.enhance_players
       where team = coalesce(p_team, 'ku') and lower(nickname) = lower(trim(p_nickname))
     );
$$;

-- 이 기기가 이 팀으로 이미 강화 기록을 갖고 있는지 — 있으면 클라이언트가 닉네임 입력
-- 단계를 건너뛰고 바로 현재 단계를 불러온다.
drop function if exists public.enhance_me(uuid);
create or replace function public.enhance_me(p_device uuid, p_team text default 'ku')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nickname', nickname, 'level', level)
  from public.enhance_players
  where device_id = p_device and team = coalesce(p_team, 'ku');
$$;

-- 닉네임 확정 시 한 번 호출 — 이 기기가 이 팀으로 이미 등록돼 있으면 새로 보낸
-- 닉네임은 무시하고 기존 기록을 그대로 돌려준다(중복 등록 방지 겸 재입장 처리).
-- 한 기기는 노아·연 둘 중 한 진영에서만 강화할 수 있다 — 반대 진영에 이미 등록돼
-- 있으면(team <> v_team) ok:false, reason:'other_team_registered'로 막는다.
-- 사전 exists() 체크와 별개로, 두 기기가 같은 닉네임을 동시에 등록하는 경합까지
-- 막기 위해 insert 자체도 "on conflict do nothing"으로 유니크 인덱스에 기대어
-- 한 번 더 걸러낸다(경합에서 진 쪽은 예외 대신 ok:false,'taken'을 받는다).
drop function if exists public.enhance_register(text, uuid, text);
create or replace function public.enhance_register(p_nickname text, p_device uuid, p_team text default 'ku')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nickname text := trim(p_nickname);
  v_team     text := coalesce(p_team, 'ku');
  v_existing public.enhance_players;
  v_inserted public.enhance_players;
begin
  select * into v_existing from public.enhance_players where device_id = p_device and team = v_team;
  if found then
    return jsonb_build_object('ok', true, 'nickname', v_existing.nickname, 'level', v_existing.level);
  end if;

  if exists (select 1 from public.enhance_players where device_id = p_device and team <> v_team) then
    return jsonb_build_object('ok', false, 'reason', 'other_team_registered');
  end if;

  if char_length(v_nickname) < 1 or char_length(v_nickname) > 14 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if exists (select 1 from public.enhance_players where team = v_team and lower(nickname) = lower(v_nickname)) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;

  insert into public.enhance_players (device_id, team, nickname, level)
  values (p_device, v_team, v_nickname, 0)
  on conflict (team, lower(nickname)) do nothing
  returning * into v_inserted;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;

  return jsonb_build_object('ok', true, 'nickname', v_inserted.nickname, 'level', 0);
end;
$$;

-- 23단계 이상으로 성공할 때마다(파괴로 내려가는 건 당연히 제외) 전체 공지급으로
-- 화면 최상단에 뜨는 웅장한 알림 — enhance_report가 성공을 반영할 때 같이 기록한다.
-- 클라이언트는 이 테이블의 INSERT를 구독해서 함성보다 훨씬 위, 화면 맨 위에 띄운다.
create table if not exists public.enhance_milestones (
  id         bigint generated always as identity primary key,
  team       text        not null check (team in ('ku', 'yu')),
  nickname   text        not null,
  level      int         not null,
  created_at timestamptz not null default now()
);

drop policy if exists "milestones readable" on public.enhance_milestones;
create policy "milestones readable" on public.enhance_milestones for select using (true);
alter table public.enhance_milestones enable row level security;

-- 웅장한 강화 알림을 실시간으로 받기 위해 올린다 — INSERT만 쓰므로 클라이언트는
-- 새로 추가되는 행만 받아본다(shouts와 같은 방식).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enhance_milestones'
  ) then
    alter publication supabase_realtime add table public.enhance_milestones;
  end if;
end
$$;

-- 강화를 시도할 때마다 호출 — 성공하면 레벨이 오르고, 16단계 이상에서 파괴가 뜨면
-- 0단계로 완전히 초기화된다. 그래서 "greatest"가 아니라 보낸 값을 그대로 반영한다
-- (파괴로 내려가는 것도 정상적인 상태 변화다). updated_at은 항상 지금 시각으로 — 랭킹
-- 동점자는 "마지막으로 그 단계였던" 시점이 빠른 쪽이 위로 오도록 한다. 23단계 이상에
-- 도달하면(파괴로 0단계가 된 경우는 제외) enhance_milestones에도 같이 기록한다.
drop function if exists public.enhance_report(uuid, int);
create or replace function public.enhance_report(p_device uuid, p_team text, p_level int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_level    int := least(30, greatest(0, coalesce(p_level, 0)));
  v_team     text := coalesce(p_team, 'ku');
  v_result   int;
  v_nickname text;
begin
  update public.enhance_players
     set level = v_level,
         updated_at = now()
   where device_id = p_device and team = v_team
  returning level, nickname into v_result, v_nickname;

  if v_result is null then
    return jsonb_build_object('ok', false);
  end if;

  if v_result >= 23 then
    insert into public.enhance_milestones (team, nickname, level) values (v_team, v_nickname, v_result);
  end if;

  return jsonb_build_object('ok', true, 'level', v_result);
end;
$$;

drop function if exists public.enhance_top(int);
create or replace function public.enhance_top(p_limit int default 10, p_team text default 'ku')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row), '[]'::jsonb) from (
    select jsonb_build_object(
      'nickname', nickname,
      'level', level,
      'rank', row_number() over (order by level desc, updated_at asc),
      'updated_at', (extract(epoch from updated_at) * 1000)::bigint
    ) as row
    from public.enhance_players
    where team = coalesce(p_team, 'ku')
    order by level desc, updated_at asc
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ) t;
$$;

drop function if exists public.enhance_mine(text);
create or replace function public.enhance_mine(p_nickname text, p_team text default 'ku')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nickname', nickname,
    'level', level,
    'rank', (
      select count(*) + 1 from public.enhance_players o
      where o.team = r.team
        and (o.level > r.level or (o.level = r.level and o.updated_at < r.updated_at))
    ),
    'updated_at', (extract(epoch from updated_at) * 1000)::bigint
  )
  from public.enhance_players r
  where r.team = coalesce(p_team, 'ku') and lower(r.nickname) = lower(trim(p_nickname))
  limit 1;
$$;

-- 직접 테이블 접근은 막는다(select 정책 없음) — 전부 위 함수로만 읽고 쓴다.
alter table public.enhance_players enable row level security;

grant execute on function public.enhance_nickname_check(text, text) to anon, authenticated;
grant execute on function public.enhance_me(uuid, text)              to anon, authenticated;
grant execute on function public.enhance_register(text, uuid, text) to anon, authenticated;
grant execute on function public.enhance_report(uuid, text, int)    to anon, authenticated;
grant execute on function public.enhance_top(int, text)             to anon, authenticated;
grant execute on function public.enhance_mine(text, text)           to anon, authenticated;

-- ---------- 랭킹 채팅 (강화 닉네임 등록자 전용) ----------
--
-- "장비 강화(enhance_players)"에 닉네임을 등록한 사람들끼리만 보낼 수 있는 전체
-- 채팅 — 노아·연 구분 없이 모두가 같은 채팅방을 본다. 닉네임·강화 단계는 클라이언트가
-- 보낸 값을 쓰지 않고, 서버가 "보내는 기기 + 그 순간 보고 있던 팀"으로
-- enhance_players에서 직접 찾아 붙인다 — 다른 사람 이름이나 단계로 보내는 걸 원천
-- 차단한다. 강화 닉네임은 팀별로만 유일(enhance_players_team_nickname_lower_idx)해서,
-- 노아·연 양쪽에 같은 닉네임이 동시에 존재할 수 있다 — 그래서 "내가 보낸 메시지"
-- 판정은 닉네임만이 아니라 (닉네임, 보낸 팀) 쌍으로 한다.

create table if not exists public.ranking_chat_messages (
  id            bigint generated always as identity primary key,
  device_id     uuid        not null,
  nickname      text        not null,
  text          text        not null check (char_length(trim(text)) between 1 and 120),
  enhance_team  text        not null default 'ku' check (enhance_team in ('ku', 'yu')),
  enhance_level int         not null default 0 check (enhance_level between 0 and 30),
  created_at    timestamptz not null default now()
);

create index if not exists ranking_chat_messages_created_at_idx
  on public.ranking_chat_messages (created_at desc);

-- 이전 버전(보스 랭킹 기준)에서 쓰던 함수 — 더 이상 쓰지 않는다.
drop function if exists public.boss_ranking_my_nickname(uuid);

-- 채팅 전송 — 이 기기가 p_team에서 강화 닉네임을 등록해 두어야만 보낼 수 있다(아니면
-- ok:false, reason:'not_registered'). 닉네임·강화 단계 모두 요청으로 받지 않고
-- enhance_players에서 직접 찾아 붙인다. 도배 방지로 같은 기기가 최근 5초 안에 이미
-- 3번 보냈으면 4번째는 ok:false, reason:'rate_limited'로 막는다. 전송에 성공하면
-- 전체 기록을 최신 50개만 남기고 오래된 것부터 지운다(테이블이 끝없이 커지지 않게).
drop function if exists public.ranking_chat_send(uuid, text, text, int);
create or replace function public.ranking_chat_send(p_device uuid, p_team text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_team   text := coalesce(p_team, 'ku');
  v_player public.enhance_players;
  v_text   text := trim(p_text);
  v_row    public.ranking_chat_messages;
begin
  select * into v_player from public.enhance_players where device_id = p_device and team = v_team;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_registered');
  end if;
  if (
    select count(*) from public.ranking_chat_messages
    where device_id = p_device and created_at > now() - interval '5 seconds'
  ) >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  if char_length(v_text) < 1 or char_length(v_text) > 120 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  insert into public.ranking_chat_messages (device_id, nickname, text, enhance_team, enhance_level)
  values (p_device, v_player.nickname, v_text, v_team, v_player.level)
  returning * into v_row;

  delete from public.ranking_chat_messages
  where id in (
    select id from public.ranking_chat_messages order by created_at desc offset 50
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'nickname', v_row.nickname,
    'text', v_row.text,
    'enhance_team', v_row.enhance_team,
    'enhance_level', v_row.enhance_level,
    'created_at', (extract(epoch from v_row.created_at) * 1000)::bigint
  );
end;
$$;

-- 최근 메시지 목록 — 채팅창을 처음 열 때 한 번 불러온다. 최신 p_limit개를 시간순(오름차순)으로.
create or replace function public.ranking_chat_recent(p_limit int default 50)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row order by created_at asc), '[]'::jsonb) from (
    select
      jsonb_build_object(
        'id', id, 'nickname', nickname, 'text', text,
        'enhance_team', enhance_team, 'enhance_level', enhance_level,
        'created_at', (extract(epoch from created_at) * 1000)::bigint
      ) as row,
      created_at
    from public.ranking_chat_messages
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) t;
$$;

-- 직접 테이블 접근은 select만 허용(쓰기는 ranking_chat_send로만) — shouts와 같은 패턴.
alter table public.ranking_chat_messages enable row level security;
drop policy if exists "ranking chat readable" on public.ranking_chat_messages;
create policy "ranking chat readable" on public.ranking_chat_messages for select using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ranking_chat_messages'
  ) then
    alter publication supabase_realtime add table public.ranking_chat_messages;
  end if;
end
$$;

grant execute on function public.ranking_chat_send(uuid, text, text) to anon, authenticated;
grant execute on function public.ranking_chat_recent(int)            to anon, authenticated;
