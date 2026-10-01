import { NextRequest, NextResponse } from "next/server";
import { topRankings, myRanking } from "./store";
import { blockedInProduction } from "@/app/api/sword/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const nickname = req.nextUrl.searchParams.get("nickname");
  return NextResponse.json({
    top: topRankings(10),
    mine: nickname ? myRanking(nickname) : null,
  });
}
