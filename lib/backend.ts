"use client";

/**
 * 공동 칼 상태를 주고받는 통로.
 *
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 있으면 Supabase를,
 * 없으면 개발용 로컬 백엔드(app/api/sword)를 쓴다. 두 쪽 모두 같은 계약을 따르므로
 * 화면 코드는 어느 쪽인지 신경 쓰지 않는다.
 */

import { RealtimeChannel, SupabaseClient, createClient } from "@supabase/supabase-js";
import { SwordState } from "./engine";
import { TeamId } from "./game";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const backendMode: "supabase" | "local" =
  SUPABASE_URL && SUPABASE_KEY ? "supabase" : "local";

/**
 * 개발용 로컬 백엔드는 프로세스 메모리에 상태를 둔다. 서버리스에 올리면
 * 인스턴스마다 칼이 달라져 "모두가 하나의 칼"이 조용히 깨진다.
 * 그래서 프로덕션 빌드에서 자격증명이 없으면 게임을 시작하지 않는다.
 */
export const isMisconfigured =
  backendMode === "local" && process.env.NODE_ENV === "production";

let client: SupabaseClient | null = null;
function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  return client;
}

/** 서버가 돌려주는 칼 상태를 클라이언트 형태로 정규화한다. */
function normalize(row: Record<string, unknown>): SwordState {
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
  const levels = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, number>) : {});
  const time = (v: unknown) => {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    const t = Date.parse(String(v));
    return Number.isNaN(t) ? 0 : t;
  };
  return {
    team: row.team as TeamId,
    energy: num(row.energy),
    lifetime: num(row.lifetime),
    taps: num(row.taps),
    tapLevels: levels(row.tap_levels ?? row.tapLevels),
    autoLevels: levels(row.auto_levels ?? row.autoLevels),
    feverGauge: num(row.fever_gauge ?? row.feverGauge),
    feverUntil: time(row.fever_until ?? row.feverUntil),
    updatedAt: time(row.updated_at ?? row.updatedAt) || Date.now(),
  };
}

export interface BuyOutcome {
  ok: boolean;
  reason?: string;
  state: SwordState;
}

async function localJson(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} 실패: ${res.status}`);
  return res.json();
}

export async function fetchSword(team: TeamId): Promise<SwordState> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("sword_get", { p_team: team });
    if (error) throw new Error(error.message);
    return normalize(data as Record<string, unknown>);
  }
  const data = await localJson(`/api/sword?team=${team}`);
  return normalize(data.sword as Record<string, unknown>);
}

export async function sendTaps(
  team: TeamId,
  taps: number,
  elapsedSeconds: number,
  clientId: string
): Promise<SwordState> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("sword_tap", {
      p_team: team,
      p_client: clientId,
      p_taps: taps,
      p_elapsed: elapsedSeconds,
    });
    if (error) throw new Error(error.message);
    return normalize(data as Record<string, unknown>);
  }
  const data = await localJson("/api/sword/tap", { team, taps, elapsedSeconds, clientId });
  return normalize(data.sword as Record<string, unknown>);
}

export async function buyUpgrade(team: TeamId, id: string): Promise<BuyOutcome> {
  if (backendMode === "supabase") {
    const { data, error } = await supabase().rpc("sword_buy", { p_team: team, p_id: id });
    if (error) throw new Error(error.message);
    const payload = data as { ok: boolean; reason?: string; sword: Record<string, unknown> };
    return { ok: payload.ok, reason: payload.reason, state: normalize(payload.sword) };
  }
  const data = (await localJson("/api/sword/buy", { team, id })) as {
    ok: boolean;
    reason?: string;
    sword: Record<string, unknown>;
  };
  return { ok: data.ok, reason: data.reason, state: normalize(data.sword) };
}

/**
 * 다른 사람이 두드린 결과를 받아본다.
 * Supabase에서는 Realtime 구독을, 로컬 백엔드에서는 폴링을 쓴다.
 */
export function subscribeSword(team: TeamId, onChange: (state: SwordState) => void): () => void {
  if (backendMode === "supabase") {
    let channel: RealtimeChannel | null = supabase()
      .channel(`sword:${team}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "swords", filter: `team=eq.${team}` },
        (payload) => onChange(normalize(payload.new as Record<string, unknown>))
      )
      .subscribe();
    return () => {
      if (channel) supabase().removeChannel(channel);
      channel = null;
    };
  }

  let alive = true;
  const timer = window.setInterval(async () => {
    if (!alive) return;
    try {
      const state = await fetchSword(team);
      if (alive) onChange(state);
    } catch {
      /* 폴링 실패는 다음 주기에 다시 시도 */
    }
  }, 1500);
  return () => {
    alive = false;
    window.clearInterval(timer);
  };
}

/**
 * 지금 같은 칼을 보고 있는 사람 수.
 *
 * Supabase에서는 Realtime Presence를 쓴다. DB에 쓰지 않고 접속/해제만으로 집계되므로
 * 사람이 많아져도 부하가 늘지 않고, 창을 닫으면 자동으로 빠진다.
 * 로컬 백엔드에서는 짧은 주기의 heartbeat로 대신한다.
 */
export function subscribePresence(
  team: TeamId,
  onCount: (count: number) => void
): () => void {
  const me = clientId();

  if (backendMode === "supabase") {
    const channel = supabase().channel(`presence:${team}`, {
      config: { presence: { key: me } },
    });

    const sync = () => {
      // 같은 기기가 여러 탭을 열어도 한 명으로 센다.
      onCount(Object.keys(channel.presenceState()).length);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
      });

    return () => {
      void supabase().removeChannel(channel);
    };
  }

  let alive = true;
  const beat = async () => {
    if (!alive) return;
    try {
      const data = (await localJson("/api/sword/presence", { team, clientId: me })) as {
        online?: number;
      };
      if (alive && typeof data.online === "number") onCount(data.online);
    } catch {
      /* 다음 주기에 다시 시도 */
    }
  };
  void beat();
  const timer = window.setInterval(beat, 5_000);
  return () => {
    alive = false;
    window.clearInterval(timer);
  };
}

/** 기기 식별값 — 계정이 아니라 연타 제한 용도로만 쓴다. */
export function clientId(): string {
  const KEY = "kyg.client";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
