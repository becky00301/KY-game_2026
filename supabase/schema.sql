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
  max_taps_per_flush  int       not null default 40,
  max_taps_per_second int       not null default 20,
  max_accrual_seconds int       not null default 120,
  fever_max           numeric   not null default 3000,
  fever_duration_ms   int       not null default 10000,
  fever_multiplier    numeric   not null default 3,
  rate_bonus_per_tap  numeric   not null default 0.02,
  rate_bonus_cap      numeric   not null default 20
);

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

-- 기기별 연타 제한용. 계정이 아니라 단순 식별값이다.
create table if not exists public.tap_budget (
  client_id    uuid primary key,
  window_start timestamptz not null default now(),
  taps         int         not null default 0
);

-- ---------- 초기값 ----------

insert into public.game_config (id, stage_thresholds, stage_growth)
values (1, array[0, 50000, 1500000, 45000000, 1500000000]::numeric[], 1.85)
on conflict (id) do update set
  stage_thresholds = excluded.stage_thresholds,
  stage_growth = excluded.stage_growth;

insert into public.upgrade_defs (id, kind, base_cost, growth, power, sort) values
  ('wrist',  'tap',       2000, 1.14,    1, 1),
  ('stick',  'tap',      40000, 1.15,    8, 2),
  ('glove',  'tap',     600000, 1.16,   55, 3),
  ('beast',  'tap',    9000000, 1.17,  400, 4),
  ('fresh',  'auto',      5000, 1.14,    3, 1),
  ('dept',   'auto',     70000, 1.15,   25, 2),
  ('band',   'auto',    900000, 1.15,  180, 3),
  ('senior', 'auto',  12000000, 1.16, 1300, 4),
  ('choir',  'auto', 150000000, 1.17, 9000, 5)
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
         updated_at = now()
   where team = p_team
   returning * into s;

  return s;
end;
$$;

-- 기기별 초당 상한을 적용해 실제로 인정할 터치 수를 정한다.
create or replace function public.sword_allow_taps(p_client uuid, p_taps int)
returns int language plpgsql as $$
declare
  cfg     public.game_config;
  b       public.tap_budget;
  capped  int;
  granted int;
begin
  select * into cfg from public.game_config where id = 1;
  capped := greatest(0, least(p_taps, cfg.max_taps_per_flush));

  select * into b from public.tap_budget where client_id = p_client for update;

  if not found or now() - b.window_start >= interval '1 second' then
    granted := least(capped, cfg.max_taps_per_second);
    insert into public.tap_budget (client_id, window_start, taps)
    values (p_client, now(), granted)
    on conflict (client_id) do update set window_start = now(), taps = granted;
    return granted;
  end if;

  granted := least(capped, greatest(0, cfg.max_taps_per_second - b.taps));
  update public.tap_budget set taps = taps + granted where client_id = p_client;
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
begin
  select * into cfg from public.game_config where id = 1;

  granted := public.sword_allow_taps(p_client, p_taps);
  s := public.sword_accrue(p_team);

  if granted <= 0 then
    return public.sword_row_json(s);
  end if;

  -- 연타 보너스는 클라이언트가 보낸 콤보가 아니라 실제 터치 속도로 계산한다.
  bonus := 1 + least(granted / greatest(coalesce(p_elapsed, 1), 0.5), cfg.rate_bonus_cap)
               * cfg.rate_bonus_per_tap;
  mult := case when s.fever_until > now() then cfg.fever_multiplier else 1 end;
  gain := public.sword_tap_power(s) * granted * bonus * mult;

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
         updated_at = now()
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
           updated_at = now()
     where team = p_team
     returning * into s;
  else
    update public.swords
       set energy = energy - cost,
           auto_levels = jsonb_set(auto_levels, array[p_id], to_jsonb(lvl + 1), true),
           updated_at = now()
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
