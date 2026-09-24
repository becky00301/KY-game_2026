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
alter table public.game_config add column if not exists critical_chance     numeric not null default 0.05;
alter table public.game_config add column if not exists critical_multiplier numeric not null default 10;

create table if not exists public.upgrade_defs (
  id        text primary key,
  kind      text    not null check (kind in ('tap', 'auto')),
  base_cost numeric not null,
  growth    numeric not null,
  power     numeric not null,
  sort      int     not null
);

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

-- ---------- 초기값 ----------

insert into public.game_config (id, stage_thresholds, stage_growth, max_taps_per_flush, max_taps_per_second, critical_chance, critical_multiplier, fever_max)
values (1, array[0, 2400, 75000, 2400000, 75000000]::numeric[], 1.85, 90, 30, 0.05, 10, 150)
on conflict (id) do update set
  stage_thresholds = excluded.stage_thresholds,
  stage_growth = excluded.stage_growth,
  max_taps_per_flush = excluded.max_taps_per_flush,
  max_taps_per_second = excluded.max_taps_per_second,
  critical_chance = excluded.critical_chance,
  critical_multiplier = excluded.critical_multiplier,
  fever_max = excluded.fever_max;

insert into public.upgrade_defs (id, kind, base_cost, growth, power, sort) values
  ('wrist',  'tap',      105, 1.14,    1, 1),
  ('stick',  'tap',     2100, 1.15,    8, 2),
  ('glove',  'tap',    30000, 1.16,   55, 3),
  ('beast',  'tap',   450000, 1.17,  400, 4),
  ('fresh',  'auto',     270, 1.14,    3, 1),
  ('dept',   'auto',    3600, 1.15,   25, 2),
  ('band',   'auto',   45000, 1.15,  180, 3),
  ('senior', 'auto',  600000, 1.16, 1300, 4),
  ('choir',  'auto', 7500000, 1.17, 9000, 5)
on conflict (id) do update set
  kind = excluded.kind,
  base_cost = excluded.base_cost,
  growth = excluded.growth,
  power = excluded.power,
  sort = excluded.sort;

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

create or replace function public.sword_upgrade_cost(p_id text, p_level numeric)
returns numeric language sql stable as $$
  select ceil(d.base_cost * (d.growth ^ p_level)) from public.upgrade_defs d where d.id = p_id;
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
create or replace function public.sword_allow_taps(p_client uuid, p_taps int)
returns int language plpgsql as $$
declare
  cfg     public.game_config;
  b       public.tap_budget;
  cap     numeric;
  tokens  numeric;
  granted int;
begin
  select * into cfg from public.game_config where id = 1;
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
  s        public.swords;
  cfg      public.game_config;
  granted  int;
  bonus    numeric;
  mult     numeric;
  gain     numeric;
  gauge    numeric;
  until    timestamptz;
  units    numeric;
  i        int;
begin
  select * into cfg from public.game_config where id = 1;

  granted := public.sword_allow_taps(p_client, p_taps);
  s := public.sword_accrue(p_team);

  if granted <= 0 then
    return public.sword_row_json(s);
  end if;

  -- 크리티컬(기본 5% 확률, 10배)을 터치 개수만큼 각각 따로 굴려서 합산한다. 클라이언트의
  -- 낙관적 예측도 터치 1회 단위로 같은 확률을 굴리므로(lib/engine.ts의 rollCritical),
  -- 정확히 같은 결과는 아니어도 평균적으로는 같은 기댓값으로 수렴한다.
  units := 0;
  for i in 1..granted loop
    if random() < cfg.critical_chance then
      units := units + cfg.critical_multiplier;
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

  update public.swords
     set energy = energy + gain,
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

-- ---------- 권한 ----------

alter table public.swords       enable row level security;
alter table public.game_config  enable row level security;
alter table public.upgrade_defs enable row level security;
alter table public.tap_budget   enable row level security;

-- 읽기만 열어 준다. 쓰기는 위 security definer 함수로만 가능하다.
drop policy if exists "swords readable" on public.swords;
create policy "swords readable" on public.swords for select using (true);

drop policy if exists "config readable" on public.game_config;
create policy "config readable" on public.game_config for select using (true);

drop policy if exists "defs readable" on public.upgrade_defs;
create policy "defs readable" on public.upgrade_defs for select using (true);
-- tap_budget은 정책을 두지 않는다 = 클라이언트에서 접근 불가.

grant execute on function public.sword_get(text)                          to anon, authenticated;
grant execute on function public.sword_tap(text, uuid, int, numeric)      to anon, authenticated;
grant execute on function public.sword_buy(text, text)                    to anon, authenticated;

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

-- 랭킹모드 전투를 실제로 시작할 때(닉네임 확정 직후) 한 번 호출 — 1회용 토큰을 발급한다.
create or replace function public.boss_ranking_start(p_nickname text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nickname text := trim(p_nickname);
  v_token    uuid;
begin
  if char_length(v_nickname) < 1 or char_length(v_nickname) > 14 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  insert into public.boss_ranking_sessions (nickname)
  values (v_nickname)
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

  update public.boss_ranking_sessions set used = true where token = p_token;

  insert into public.boss_rankings (nickname)
  values (v_nickname)
  on conflict (lower(nickname)) do nothing
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
grant execute on function public.boss_ranking_start(text)       to anon, authenticated;
grant execute on function public.boss_ranking_submit(text, uuid) to anon, authenticated;
grant execute on function public.boss_ranking_top(int)           to anon, authenticated;
grant execute on function public.boss_ranking_mine(text)         to anon, authenticated;
