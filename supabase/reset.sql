-- 칼 초기화 — 행사 시작 직전에 SQL Editor에서 실행한다.
--
-- 테스트로 쌓인 기운·터치·강화를 전부 0으로 돌린다.
-- 테이블 구조와 설정(game_config, upgrade_defs)은 그대로 둔다.

update public.swords
   set energy      = 0,
       lifetime    = 0,
       taps        = 0,
       tap_levels  = '{}'::jsonb,
       auto_levels = '{}'::jsonb,
       fever_gauge = 0,
       fever_until = 'epoch',
       updated_at  = now();

-- 연타 제한 기록도 비운다.
delete from public.tap_budget;

-- 결과 확인
select team, energy, lifetime, taps, tap_levels, auto_levels from public.swords order by team;
