import { NextRequest, NextResponse } from "next/server";
import { touchPresence } from "../store";
import { blockedInProduction } from "../guard";
import { TeamId } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as {
    team?: string;
    clientId?: string;
  } | null;

  const team = body?.team;
  if (team !== "ku" && team !== "yu") {
    return NextResponse.json({ error: "team은 ku 또는 yu여야 합니다" }, { status: 400 });
  }
  const clientId = String(body?.clientId ?? "");
  if (!clientId) return NextResponse.json({ error: "clientId가 필요합니다" }, { status: 400 });

  return NextResponse.json({ online: touchPresence(team as TeamId, clientId) });
}
