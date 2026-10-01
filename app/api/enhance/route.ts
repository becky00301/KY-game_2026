import { NextRequest, NextResponse } from "next/server";
import { topRankings, myRanking } from "./store";
import { blockedInProduction } from "@/app/api/sword/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const nickname = req.nextUrl.searchParams.get("nickname");
  const team = req.nextUrl.searchParams.get("team") ?? "ku";
  return NextResponse.json({
    top: topRankings(team, 10),
    mine: nickname ? myRanking(nickname, team) : null,
  });
}
