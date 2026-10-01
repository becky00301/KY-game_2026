"use client";

/**
 * 운영자용 현황판. 숨겨진 주소(/admin)이고 검색에도 안 잡히게 해뒀다.
 * 점수·접속자는 누구나 볼 수 있는 값이라 그냥 보여주고, 기기별 터치 기록만 열쇠를 요구한다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SwordState,
  createSword,
  stageOf,
  starRank,
  autoPerSecond,
  tapPower,
  FEVER_MAX,
  MAX_TAPS_PER_SECOND,
} from "@/lib/engine";
import { TEAMS, TeamId, formatNumber, formatRate } from "@/lib/game";
import {
  TapStatRow,
  backendMode,
  fetchSword,
  fetchTapStats,
  observePresence,
  subscribeSword,
} from "@/lib/backend";

const TEAM_IDS: TeamId[] = ["ku", "yu"];
/** 터치 속도를 재는 간격 */
const RATE_SAMPLE_MS = 5_000;
const KEY_STORAGE = "kyg.adminKey";

interface TeamView {
  sword: SwordState;
  online: number;
  /** 최근 구간의 초당 터치 수 */
  tapsPerSecond: number;
}

export default function AdminPage() {
  const [view, setView] = useState<Record<TeamId, TeamView>>({
    ku: { sword: createSword("ku"), online: 0, tapsPerSecond: 0 },
    yu: { sword: createSword("yu"), online: 0, tapsPerSecond: 0 },
  });
  const [adminKey, setAdminKey] = useState("");
  const [stats, setStats] = useState<TapStatRow[] | null>(null);
  const [statsError, setStatsError] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(10);
  const lastSample = useRef<Record<TeamId, { taps: number; at: number } | null>>({ ku: null, yu: null });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY_STORAGE);
      if (saved) setAdminKey(saved);
    } catch {
      /* 저장 못 해도 입력해서 쓰면 된다 */
    }
  }, []);

  // 칼 상태 — 처음 한 번 읽고, 그 뒤로는 실시간 구독으로 따라간다.
  useEffect(() => {
    const stops: Array<() => void> = [];
    for (const team of TEAM_IDS) {
      fetchSword(team)
        .then((sword) => setView((v) => ({ ...v, [team]: { ...v[team], sword } })))
        .catch(() => {});
      stops.push(subscribeSword(team, (sword) => setView((v) => ({ ...v, [team]: { ...v[team], sword } }))));
      stops.push(observePresence(team, (online) => setView((v) => ({ ...v, [team]: { ...v[team], online } }))));
    }
    return () => stops.forEach((stop) => stop());
  }, []);

  // 터치 속도 — 전체 터치 수의 변화량으로 잰다.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      for (const team of TEAM_IDS) {
        try {
          const sword = await fetchSword(team);
          const now = Date.now();
          const prev = lastSample.current[team];
          lastSample.current[team] = { taps: sword.taps, at: now };
          if (!prev) continue;
          const seconds = Math.max((now - prev.at) / 1000, 1);
          const perSecond = Math.max(0, (sword.taps - prev.taps) / seconds);
          setView((v) => ({ ...v, [team]: { ...v[team], sword, tapsPerSecond: perSecond } }));
        } catch {
          /* 다음 주기에 다시 */
        }
      }
    }, RATE_SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsError("");
    try {
      const rows = await fetchTapStats(adminKey, windowMinutes);
      setStats(rows);
      if (rows.length === 0) setStatsError("기록이 없거나 열쇠가 맞지 않습니다.");
      try {
        window.localStorage.setItem(KEY_STORAGE, adminKey);
      } catch {
        /* noop */
      }
    } catch (e) {
      setStats(null);
      setStatsError((e as Error).message);
    }
  }, [adminKey, windowMinutes]);

  // 열쇠를 넣어 한 번 조회했으면 그 뒤로는 자동 갱신한다.
  useEffect(() => {
    if (stats === null) return;
    const timer = window.setInterval(() => void loadStats(), 15_000);
    return () => window.clearInterval(timer);
  }, [stats, loadStats]);

  const totalOnline = view.ku.online + view.yu.online;
  const suspicious = useMemo(
    () => (stats ?? []).filter((r) => r.perSecond >= MAX_TAPS_PER_SECOND * 0.7 && r.minutes >= 2),
    [stats]
  );

  return (
    <main className="admin">
      <header className="admin-head">
        <h1>운영 현황판</h1>
        <p className="admin-sub">
          {backendMode === "supabase" ? "실서버" : "로컬 테스트 서버"} · 접속자 합계 <strong>{totalOnline}명</strong>
        </p>
      </header>

      <section className="admin-grid">
        {TEAM_IDS.map((team) => {
          const { sword, online, tapsPerSecond } = view[team];
          const theme = TEAMS[team];
          const stage = stageOf(sword.lifetime);
          return (
            <article key={team} className="admin-card">
              <h2>{theme.short}</h2>
              <dl>
                <div><dt>지금 접속</dt><dd><strong>{online}명</strong></dd></div>
                <div><dt>초당 터치</dt><dd>{tapsPerSecond.toFixed(1)}회</dd></div>
                <div><dt>점수(누적)</dt><dd>{formatNumber(sword.lifetime)}</dd></div>
                <div><dt>보유 재화</dt><dd>{formatNumber(sword.energy)}</dd></div>
                <div><dt>단계</dt><dd>{stage + 1}단계 · 별 {starRank(sword.lifetime)}개</dd></div>
                <div><dt>전체 터치</dt><dd>{formatNumber(sword.taps)}회</dd></div>
                <div><dt>터치당 / 초당</dt><dd>{formatRate(tapPower(sword))} / {formatRate(autoPerSecond(sword))}</dd></div>
                <div><dt>응원 열기</dt><dd>{Math.round((sword.feverGauge / FEVER_MAX) * 100)}%{sword.feverUntil > Date.now() ? " · 발동 중" : ""}</dd></div>
              </dl>
            </article>
          );
        })}
      </section>

      <section className="admin-card">
        <h2>기기별 터치 기록</h2>
        <div className="admin-row">
          <input
            className="admin-input"
            type="password"
            placeholder="관리자 열쇠"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
          />
          <select
            className="admin-input admin-select"
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(Number(e.target.value))}
          >
            <option value={5}>최근 5분</option>
            <option value={10}>최근 10분</option>
            <option value={30}>최근 30분</option>
            <option value={60}>최근 1시간</option>
          </select>
          <button className="admin-btn" onClick={() => void loadStats()}>조회</button>
        </div>
        {statsError && <p className="admin-error">{statsError}</p>}
        {stats && stats.length > 0 && (
          <>
            {suspicious.length > 0 && (
              <p className="admin-warn">
                초당 {(MAX_TAPS_PER_SECOND * 0.7).toFixed(0)}회 이상을 2분 넘게 유지한 기기 {suspicious.length}대 — 매크로 의심
              </p>
            )}
            <table className="admin-table">
              <thead>
                <tr><th>기기</th><th>터치</th><th>활동(분)</th><th>초당</th><th>상태</th></tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.clientId} className={row.perSecond >= MAX_TAPS_PER_SECOND * 0.7 && row.minutes >= 2 ? "admin-suspect" : ""}>
                    <td className="admin-id" title={row.clientId}>{row.clientId.slice(0, 8)}</td>
                    <td>{formatNumber(row.taps)}</td>
                    <td>{row.minutes}</td>
                    <td>{row.perSecond.toFixed(1)}</td>
                    <td>{row.blocked ? "차단됨" : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="admin-note">
              사람은 보통 초당 5회 안팎, 아주 빠르면 8~10회입니다. 10회 이상을 여러 분 연속으로 유지하면 매크로로 보시면 됩니다.
              차단은 SQL Editor에서: <code>insert into public.tap_blocklist (client_id, reason) values (&apos;기기아이디&apos;, &apos;매크로&apos;);</code>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
