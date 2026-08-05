import { NextRequest, NextResponse } from "next/server";
import { getSword } from "./store";
import { blockedInProduction } from "./guard";
import { TeamId } from "@/lib/game";

export const dynamic = "force-dynamic";

function parseTeam(value: string | null): TeamId | null {
  return value === "ku" || value === "yu" ? value : null;
}

export async function GET(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const team = parseTeam(req.nextUrl.searchParams.get("team"));
  if (!team) return NextResponse.json({ error: "team은 ku 또는 yu여야 합니다" }, { status: 400 });
  return NextResponse.json({ sword: getSword(team) });
}
