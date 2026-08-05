import { NextRequest, NextResponse } from "next/server";
import { buySwordUpgrade } from "../store";
import { blockedInProduction } from "../guard";
import { TeamId } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as { team?: string; id?: string } | null;

  const team = body?.team;
  if (team !== "ku" && team !== "yu") {
    return NextResponse.json({ error: "team은 ku 또는 yu여야 합니다" }, { status: 400 });
  }
  if (!body?.id) return NextResponse.json({ error: "강화 id가 필요합니다" }, { status: 400 });

  const outcome = buySwordUpgrade(team as TeamId, body.id);
  return NextResponse.json({
    ok: outcome.ok,
    reason: outcome.ok ? undefined : outcome.reason,
    sword: outcome.state,
  });
}
