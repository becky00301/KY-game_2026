import { NextRequest, NextResponse } from "next/server";
import { tapSword } from "../store";
import { blockedInProduction } from "../guard";
import { TeamId } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as {
    team?: string;
    taps?: number;
    elapsedSeconds?: number;
    clientId?: string;
  } | null;

  const team = body?.team;
  if (team !== "ku" && team !== "yu") {
    return NextResponse.json({ error: "team은 ku 또는 yu여야 합니다" }, { status: 400 });
  }
  const taps = Number(body?.taps ?? 0);
  const elapsed = Number(body?.elapsedSeconds ?? 1);
  const clientId = String(body?.clientId ?? "");
  if (!Number.isFinite(taps) || taps < 0 || !clientId) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const sword = tapSword(team as TeamId, Math.floor(taps), Math.max(elapsed, 0), clientId);
  return NextResponse.json({ sword });
}
